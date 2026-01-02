const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const supabase = require('../config/supabase'); 
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { handleChatStream: handleProChatStream } = require('../controllers/dardcorProModel');
const { handleChatStream: handleBasicChatStream } = require('../controllers/dardcorBasicModel');
const { handleChatStream: handleDarkChatStream } = require('../controllers/dardcorDarkModel');
const { YoutubeTranscript } = require('youtube-transcript');
const cheerio = require('cheerio');
const axios = require('axios');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

// === CONFIGURATION ===
// Limit upload 50MB untuk file besar
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); 
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: "Terlalu banyak percobaan." });

// === MIDDLEWARE & UTILS ===
const uploadMiddleware = (req, res, next) => { 
    upload.array('file_attachment', 10)(req, res, function (err) { 
        if (err) return res.status(400).json({ success: false, message: "Upload Error" }); 
        next(); 
    }); 
};

function getCookie(req, name) { 
    if (req.cookies && req.cookies[name]) return req.cookies[name]; 
    if (!req.headers.cookie) return null; 
    const value = `; ${req.headers.cookie}`; 
    const parts = value.split(`; ${name}=`); 
    if (parts.length === 2) return parts.pop().split(';').shift(); 
    return null; 
}

async function checkUserAuth(req, res, next) { 
    if (req.session && req.session.userAccount) return next(); 
    const userId = getCookie(req, 'dardcor_uid'); 
    if (userId) { 
        try { 
            const { data: user } = await supabase.from('dardcor_users').select('*').eq('id', userId).single(); 
            if (user) { 
                req.session.userAccount = user; 
                const tenYears = 1000 * 60 * 60 * 24 * 365 * 10; 
                req.session.cookie.expires = new Date(Date.now() + tenYears); 
                req.session.cookie.maxAge = tenYears; 
                return req.session.save(() => next()); 
            } 
        } catch (e) {} 
    } 
    if (req.xhr || req.headers.accept.indexOf('json') > -1) { 
        return res.status(401).json({ success: false, redirectUrl: '/dardcor' }); 
    } 
    res.redirect('/dardcor'); 
}

// === UNLIMITED KEYWORD EXTRACTION ===
function extractKeywords(text) {
    if (!text) return "";
    const cleanText = text.replace(/[^\w\s]/gi, ' ').toLowerCase();
    const words = cleanText.split(/\s+/);
    
    const stopWords = [
        'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'adalah', 'saya', 'kamu', 'dia', 'mereka', 'kita',
        'apa', 'siapa', 'kapan', 'dimana', 'kenapa', 'bagaimana', 'bisa', 'tolong', 'minta', 'buatkan', 'jelaskan', 'gimana', 'dong', 'sih',
        'the', 'is', 'at', 'of', 'in', 'and', 'or', 'to', 'for', 'with', 'a', 'an', 'are', 'this', 'that', 'how', 'what', 'why'
    ];
    
    // Unlimited keywords (No slice/limit)
    const keywords = [...new Set(words.filter(w => w.length > 2 && !stopWords.includes(w)))];
    return keywords.join(' | '); 
}

// === SCRAPING TOOLS (FULL CONTENT) ===
async function getYouTubeData(url) { 
    let videoId = null; 
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; 
    const match = url.match(regExp); 
    if (match && match[2].length === 11) videoId = match[2]; 
    if (!videoId) return { success: false }; 
    let data = { title: '', description: '', transcript: '' }; 
    try { 
        const pageRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }); 
        const $ = cheerio.load(pageRes.data); 
        data.title = $('meta[name="title"]').attr('content') || $('title').text(); 
        data.description = $('meta[name="description"]').attr('content') || ''; 
    } catch (e) {} 
    try { 
        const transcriptObj = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'id' }).catch(() => YoutubeTranscript.fetchTranscript(videoId)); 
        if (transcriptObj && transcriptObj.length > 0) { 
            data.transcript = transcriptObj.map(t => t.text).join(' '); 
        } 
    } catch (e) {} 
    return { success: true, ...data }; 
}

async function getWebsiteContent(url) { 
    try { 
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }); 
        const $ = cheerio.load(response.data); 
        $('script, style, nav, footer, header, svg, img, iframe, noscript').remove(); 
        // Unlimited text (No truncation)
        return $('body').text().replace(/\s+/g, ' ').trim(); 
    } catch (e) { return null; } 
}

async function searchWeb(query) { 
    try { 
        if (!query) return null; 
        const searchQuery = encodeURIComponent(query); 
        const res = await axios.get(`https://ddg-api.herokuapp.com/search?q=${searchQuery}&limit=5`); 
        if (res.data && res.data.length > 0) { 
            return res.data.map(r => `- [${r.title}](${r.link}): ${r.snippet}`).join('\n'); 
        } 
        return null; 
    } catch (e) { return null; } 
}

// === ROUTES ===
router.get('/', (req, res) => { if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai'); res.render('index', { user: null }); });
router.get('/dardcor', (req, res) => { if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai'); res.render('dardcor', { error: null }); });
router.get('/register', (req, res) => { if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai'); res.render('register', { error: null }); });

// AUTH
router.post('/dardcor-login', authLimiter, async (req, res) => { 
    let { email, password } = req.body; 
    try { 
        const { data: user } = await supabase.from('dardcor_users').select('*').eq('email', email.trim().toLowerCase()).single(); 
        if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ success: false, message: 'Login gagal.' }); 
        req.session.userAccount = user; 
        const tenYears = 1000 * 60 * 60 * 24 * 365 * 10; 
        req.session.cookie.expires = new Date(Date.now() + tenYears); 
        req.session.cookie.maxAge = tenYears; 
        res.cookie('dardcor_uid', user.id, { maxAge: tenYears, httpOnly: true, secure: true, sameSite: 'lax' }); 
        req.session.save((err) => { 
            if (err) return res.status(500).json({ success: false }); 
            res.status(200).json({ success: true, redirectUrl: '/dardcorchat/dardcor-ai' }); 
        }); 
    } catch (err) { res.status(500).json({ success: false }); } 
});

router.get('/dardcor-logout', (req, res) => { 
    res.clearCookie('dardcor_uid'); 
    req.session.destroy(() => { 
        res.clearCookie('connect.sid'); 
        res.redirect('/dardcor'); 
    }); 
});

router.post('/register', authLimiter, async (req, res) => { 
    let { username, email, password } = req.body; email = email.trim().toLowerCase(); 
    try { 
        const { data: existingUser } = await supabase.from('dardcor_users').select('email').eq('email', email).single(); 
        if (existingUser) return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' }); 
        await supabase.from('verification_codes').delete().eq('email', email); 
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
        const hashedPassword = await bcrypt.hash(password, 12); 
        await supabase.from('verification_codes').insert([{ username, email, password: hashedPassword, otp }]); 
        await transporter.sendMail({ from: '"Dardcor Security" <no-reply@dardcor.com>', to: email, subject: 'Kode Verifikasi', html: `<div><h2>OTP:</h2><h1>${otp}</h1></div>` }); 
        res.status(200).json({ success: true, email: email, redirectUrl: `/verify-otp?email=${encodeURIComponent(email)}` }); 
    } catch (err) { res.status(500).json({ success: false }); } 
});

router.get('/verify-otp', (req, res) => { if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai'); res.render('verify', { email: req.query.email }); });
router.post('/verify-otp', async (req, res) => { 
    try { 
        const { data: record } = await supabase.from('verification_codes').select('*').eq('email', req.body.email).eq('otp', req.body.otp).single(); 
        if (!record) return res.status(400).json({ success: false }); 
        const { data: newUser } = await supabase.from('dardcor_users').insert([{ username: record.username, email: record.email, password: record.password }]).select().single(); 
        await supabase.from('verification_codes').delete().eq('email', req.body.email); 
        req.session.userAccount = newUser; 
        const tenYears = 1000 * 60 * 60 * 24 * 365 * 10; 
        req.session.cookie.expires = new Date(Date.now() + tenYears); 
        req.session.cookie.maxAge = tenYears; 
        res.cookie('dardcor_uid', newUser.id, { maxAge: tenYears, httpOnly: true, secure: true, sameSite: 'lax' }); 
        req.session.save(() => { res.status(200).json({ success: true, redirectUrl: '/dardcorchat/dardcor-ai' }); }); 
    } catch (err) { res.status(500).json({ success: false }); } 
});

// PROFILE & CHAT
router.get('/dardcorchat/profile', checkUserAuth, (req, res) => { res.render('dardcorchat/profile', { user: req.session.userAccount, success: null, error: null }); });
router.post('/dardcor/profile/update', checkUserAuth, upload.single('profile_image'), async (req, res) => { 
    const userId = req.session.userAccount.id; 
    let updates = { username: req.body.username }; 
    try { 
        if (req.body.password && req.body.password.trim() !== "") { 
            if (req.body.password !== req.body.confirm_password) return res.render('dardcorchat/profile', { user: req.session.userAccount, error: "Password beda.", success: null }); 
            updates.password = await bcrypt.hash(req.body.password.trim(), 12); 
        } 
        if (req.file) { 
            const fileName = `${userId}-${Date.now()}.${req.file.originalname.split('.').pop()}`; 
            await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true }); 
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName); 
            updates.profile_image = data.publicUrl; 
        } 
        const { data } = await supabase.from('dardcor_users').update(updates).eq('id', userId).select().single(); 
        req.session.userAccount = data; 
        req.session.save(() => { res.render('dardcorchat/profile', { user: data, success: "Sukses!", error: null }); }); 
    } catch (err) { res.render('dardcorchat/profile', { user: req.session.userAccount, error: err.message, success: null }); } 
});

router.get('/dardcorchat/dardcor-ai', checkUserAuth, (req, res) => { res.redirect(`/dardcorchat/dardcor-ai/${uuidv4()}`); });
router.get('/dardcorchat/dardcor-ai/:conversationId', checkUserAuth, async (req, res) => { 
    const userId = req.session.userAccount.id; 
    const requestedId = req.params.conversationId; 
    const toolType = req.params.toolType || 'basic'; 
    try { 
        const { data: conversationList } = await supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false }); 
        let activeId = requestedId; 
        if (!activeId || activeId.length < 10) { 
            activeId = uuidv4(); 
            return res.redirect(`/dardcorchat/dardcor-ai/${activeId}`); 
        } 
        const { data: activeChatHistory } = await supabase.from('history_chat').select('*').eq('conversation_id', activeId).order('created_at', { ascending: true }); 
        req.session.currentConversationId = activeId; 
        res.render('dardcorchat/layout', { user: req.session.userAccount, chatHistory: activeChatHistory || [], conversationList: conversationList || [], activeConversationId: activeId, toolType: toolType, contentPage: 'dardcorai' }); 
    } catch (err) { res.redirect('/dardcor'); } 
});

router.get('/api/chat/:conversationId', checkUserAuth, async (req, res) => { 
    const userId = req.session.userAccount.id; 
    try { 
        const { data: history } = await supabase.from('history_chat').select('*').eq('conversation_id', req.params.conversationId).eq('user_id', userId).order('created_at', { ascending: true }); 
        req.session.currentConversationId = req.params.conversationId; 
        req.session.save(); 
        res.json({ success: true, history: history || [] }); 
    } catch (err) { res.status(500).json({ success: false }); } 
});

router.post('/dardcorchat/ai/new-chat', checkUserAuth, (req, res) => { req.session.currentConversationId = null; req.session.save(() => { res.json({ success: true, redirectUrl: `/dardcorchat/dardcor-ai/${uuidv4()}` }); }); });
router.post('/dardcorchat/ai/rename-chat', checkUserAuth, async (req, res) => { try { await supabase.from('conversations').update({ title: req.body.newTitle }).eq('id', req.body.conversationId).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); } });
router.post('/dardcorchat/ai/delete-chat-history', checkUserAuth, async (req, res) => { try { await supabase.from('conversations').delete().eq('id', req.body.conversationId).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); } });

// PREVIEW & DATA API
router.post('/dardcorchat/ai/store-preview', checkUserAuth, async (req, res) => { 
    const previewId = uuidv4(); 
    try { await supabase.from('previews_website').insert({ id: previewId, user_id: req.session.userAccount.id, code: req.body.code, type: req.body.type || 'website' }); res.json({ success: true, previewId }); } catch (error) { res.status(500).json({ success: false }); } 
});
router.get('/dardcorchat/dardcor-ai/preview/:id', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('previews_website').select('code').eq('id', req.params.id).single(); if (!data) return res.status(404).send('Not Found'); res.setHeader('Content-Type', 'text/html'); res.send(data.code); } catch (err) { res.status(500).send("Error"); } });
router.get('/dardcorchat/dardcor-ai/diagram/:id', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('previews_website').select('code').eq('id', req.params.id).single(); if (!data) return res.status(404).send('Not Found'); const codeBase64 = Buffer.from(data.code).toString('base64'); res.render('dardcorchat/diagram', { code: codeBase64 }); } catch (err) { res.status(500).send("Error"); } });

router.get('/api/personas', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('personas').select('*').eq('user_id', req.session.userAccount.id); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false }); } });
router.post('/api/personas', checkUserAuth, async (req, res) => { try { const { name, instruction } = req.body; const { data } = await supabase.from('personas').insert({ user_id: req.session.userAccount.id, name, instruction, is_public: false }).select().single(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false }); } });
router.delete('/api/personas/:id', checkUserAuth, async (req, res) => { try { await supabase.from('personas').delete().eq('id', req.params.id).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });

router.get('/api/vault', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('vault_docs').select('id, title, created_at').eq('user_id', req.session.userAccount.id); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false }); } });
router.post('/api/vault', checkUserAuth, async (req, res) => { try { const { title, content } = req.body; await supabase.from('vault_docs').insert({ user_id: req.session.userAccount.id, title, content }); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
router.delete('/api/vault/:id', checkUserAuth, async (req, res) => { try { await supabase.from('vault_docs').delete().eq('id', req.params.id).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });

router.get('/api/memories', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('user_memories').select('*').eq('user_id', req.session.userAccount.id); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false }); } });
router.post('/api/memories', checkUserAuth, async (req, res) => { try { await supabase.from('user_memories').insert({ user_id: req.session.userAccount.id, fact: req.body.fact }); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
router.delete('/api/memories/:id', checkUserAuth, async (req, res) => { try { await supabase.from('user_memories').delete().eq('id', req.params.id).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });

// ============================================================================
// MAIN CHAT LOGIC (UNLIMITED CONTEXT + UNIFIED HANDLER)
// ============================================================================
router.post('/dardcorchat/ai/chat-stream', checkUserAuth, uploadMiddleware, async (req, res) => {
    const userId = req.session.userAccount.id;
    let message = req.body.message ? req.body.message.trim() : "";
    const uploadedFiles = req.files || [];
    let conversationId = req.body.conversationId || uuidv4();
    const toolType = req.body.toolType || 'basic';
    let personaId = req.body.personaId;

    if (personaId === 'null' || personaId === 'undefined' || !personaId) personaId = null;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let botMessageId = null;
    let fullResponse = "";

    try {
        // === 1. BUILD SYSTEM CONTEXT (UNLIMITED) ===
        const contextData = { vaultContent: '', memories: '', searchResults: '', globalHistory: '' };
        const searchKeywords = extractKeywords(message);
        
        // Time Context
        const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let systemContext = `\n[WAKTU SAAT INI]: ${currentDate}\n`;

        // === 2. HANDLE URLS ===
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.match(urlRegex);
        if (urls && urls.length > 0) {
            for (const url of urls) {
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    const ytData = await getYouTubeData(url);
                    if (ytData.success) {
                        systemContext += `\n[YT VIDEO]: JUDUL: ${ytData.title}, DESC: ${ytData.description}, TRANSKRIP: ${ytData.transcript}\n`;
                    }
                } else {
                    const pageContent = await getWebsiteContent(url);
                    if (pageContent) systemContext += `\n[WEBSITE]: URL: ${url}, ISI: ${pageContent}\n`;
                }
            }
        }
        
        if (systemContext.trim().length > 0) {
            message = `${systemContext}\n\nUSER QUERY: ${message}`;
        }

        // === 3. WEB SEARCH TRIGGER ===
        if (message.toLowerCase().match(/(cari|search|harga|terbaru|berita|info tentang)/)) {
            const searchRes = await searchWeb(message);
            if (searchRes) contextData.searchResults = searchRes;
        }

        // === 4. UNLIMITED MEMORY RETRIEVAL (NO LIMITS) ===
        // A. Fakta Tersimpan
        const { data: memories } = await supabase.from('user_memories').select('fact').eq('user_id', userId);
        if (memories && memories.length > 0) contextData.memories = memories.map(m => `- ${m.fact}`).join('\n');

        // B. Dokumen Vault
        if (searchKeywords.length > 0) {
            const { data: vault } = await supabase.from('vault_docs').select('title, content').eq('user_id', userId).textSearch('content', searchKeywords);
            if (vault && vault.length > 0) {
                contextData.vaultContent = vault.map(v => `[DOC: ${v.title}]\n${v.content}`).join('\n\n');
            }
        }

        // C. Global History
        if (searchKeywords.length > 0) {
            const { data: globalRecalls } = await supabase.from('history_chat')
                .select('message, created_at')
                .eq('user_id', userId)
                .neq('conversation_id', conversationId)
                .eq('role', 'user')
                .textSearch('message', searchKeywords);
            
            if (globalRecalls && globalRecalls.length > 0) {
                contextData.globalHistory = globalRecalls.map(r => `[CHAT LAMA ${new Date(r.created_at).toLocaleDateString()}]: "${r.message}"`).join('\n');
            }
        }

        // === 5. HANDLE FILES ===
        const geminiFiles = [];
        let fileTextContext = "";
        if (uploadedFiles.length > 0) {
            for (const file of uploadedFiles) {
                const mime = file.mimetype;
                if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf') {
                    geminiFiles.push(file);
                } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    try { const result = await mammoth.extractRawText({ buffer: file.buffer }); fileTextContext += `\n[WORD: ${file.originalname}]\n${result.value}\n`; } catch (e) {}
                } else if (mime.includes('spreadsheet') || mime.includes('excel')) {
                    try { const workbook = xlsx.read(file.buffer, { type: 'buffer' }); const sheetName = workbook.SheetNames[0]; const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]); fileTextContext += `\n[EXCEL: ${file.originalname}]\n${csv}\n`; } catch (e) {}
                } else {
                    fileTextContext += `\n[FILE: ${file.originalname}]\n${file.buffer.toString('utf-8')}\n`;
                }
            }
        }
        if (fileTextContext) message += `\n\n${fileTextContext}`;

        // === 6. SAVE TO DB & INIT ===
        const userMessageDisplay = req.body.message || (uploadedFiles.length > 0 ? `Analisis ${uploadedFiles.length} file...` : "...");
        const { data: convCheck } = await supabase.from('conversations').select('id').eq('id', conversationId).single();
        if (!convCheck) await supabase.from('conversations').insert({ id: conversationId, user_id: userId, title: userMessageDisplay.substring(0, 30) });
        else await supabase.from('conversations').update({ updated_at: new Date() }).eq('id', conversationId);

        let fileMetadata = uploadedFiles.map(f => ({ filename: f.originalname, size: f.size, mimetype: f.mimetype }));
        await supabase.from('history_chat').insert({ user_id: userId, conversation_id: conversationId, role: 'user', message: userMessageDisplay, file_metadata: fileMetadata });
        const { data: botMsg } = await supabase.from('history_chat').insert({ user_id: userId, conversation_id: conversationId, role: 'bot', message: '' }).select('id').single();
        if (botMsg) botMessageId = botMsg.id;

        const { data: historyData } = await supabase.from('history_chat').select('role, message').eq('conversation_id', conversationId).order('created_at', { ascending: true });

        // === 7. EXECUTE AI MODEL (UNIFIED HANDLER) ===
        // Semua model (Basic, Pro, Dark) sekarang menerima contextData secara langsung!
        
        let customSystemPrompt = null;
        if (personaId) {
            const { data: persona } = await supabase.from('personas').select('instruction').eq('id', personaId).maybeSingle();
            if (persona) customSystemPrompt = persona.instruction;
        }

        let stream;
        if (toolType === 'pro') {
            stream = await handleProChatStream(message, geminiFiles, historyData, toolType, customSystemPrompt, contextData);
        } else if (toolType === 'dark') {
            stream = await handleDarkChatStream(message, geminiFiles, historyData, toolType, customSystemPrompt, contextData);
        } else {
            // Basic Model sekarang juga pintar dengan contextData
            stream = await handleBasicChatStream(message, geminiFiles, historyData, toolType, customSystemPrompt, contextData);
        }

        // === 8. STREAM RESPONSE ===
        req.on('close', async () => {
            if (botMessageId && fullResponse) await supabase.from('history_chat').update({ message: fullResponse }).eq('id', botMessageId);
        });

        for await (const chunk of stream) {
            const chunkText = chunk.text();
            fullResponse += chunkText;
            res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
        }

        if (botMessageId) await supabase.from('history_chat').update({ message: fullResponse }).eq('id', botMessageId);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

    } catch (error) {
        console.error("Stream Error:", error);
        if (botMessageId && fullResponse) await supabase.from('history_chat').update({ message: fullResponse }).eq('id', botMessageId);
        res.write(`data: ${JSON.stringify({ error: "Terjadi kesalahan server." })}\n\n`);
        res.end();
    }
});

module.exports = router;