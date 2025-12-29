const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const supabase = require('../config/supabase'); 
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { handleChatStream } = require('../controllers/dardcorModel');
const { YoutubeTranscript } = require('youtube-transcript');
const cheerio = require('cheerio');
const axios = require('axios');

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    message: "Terlalu banyak percobaan. Silakan coba lagi nanti."
});

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

// UPDATE: LIMIT 10 FILE
const uploadMiddleware = (req, res, next) => {
    upload.array('file_attachment', 10)(req, res, function (err) {
        if (err) return res.status(400).json({ success: false, response: "Max 10 File (@10MB)." });
        next();
    });
};

async function getYouTubeData(url) {
    let videoId = null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) videoId = match[2];

    if (!videoId) return { success: false, message: "ID Video tidak valid." };

    let data = { title: '', description: '', transcript: '' };

    try {
        const pageRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(pageRes.data);
        data.title = $('meta[name="title"]').attr('content') || $('title').text();
        data.description = $('meta[name="description"]').attr('content') || '';
    } catch (e) {}

    try {
        const transcriptObj = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'id' }).catch(() => {
            return YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        }).catch(() => {
            return YoutubeTranscript.fetchTranscript(videoId); 
        });

        if (transcriptObj && transcriptObj.length > 0) {
            data.transcript = transcriptObj.map(t => t.text).join(' ');
        }
    } catch (e) {
        console.log("Transcript Fetch Error:", e.message);
    }

    return { success: true, ...data };
}

async function getWebsiteContent(url) {
    try {
        const response = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 10000 
        });
        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, svg, img, iframe, noscript').remove();
        return $('body').text().replace(/\s+/g, ' ').trim(); 
    } catch (e) {
        return null;
    }
}

router.get('/', (req, res) => {
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai');
    res.render('index', { user: null });
});

router.get('/dardcor', (req, res) => { 
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai'); 
    res.render('dardcor', { error: null }); 
});

router.get('/register', (req, res) => { 
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai');
    res.render('register', { error: null }); 
});

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
            if (err) return res.status(500).json({ success: false, message: 'Gagal memproses login.' });
            res.status(200).json({ success: true, redirectUrl: '/dardcorchat/dardcor-ai' });
        });
    } catch (err) { res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem.' }); }
});

router.get('/dardcor-logout', (req, res) => { 
    res.clearCookie('dardcor_uid');
    req.session.destroy((err) => { res.clearCookie('connect.sid'); res.redirect('/dardcor'); });
});

router.post('/register', authLimiter, async (req, res) => {
    let { username, email, password } = req.body;
    email = email.trim().toLowerCase();
    try {
        const { data: existingUser } = await supabase.from('dardcor_users').select('email').eq('email', email).single();
        if (existingUser) return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });

        await supabase.from('verification_codes').delete().eq('email', email);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 12);

        await supabase.from('verification_codes').insert([{ username, email, password: hashedPassword, otp }]);
        await transporter.sendMail({
            from: '"Dardcor Security" <no-reply@dardcor.com>', to: email, subject: 'Kode Verifikasi Dardcor AI',
            html: `<div style="font-family: sans-serif; padding:20px;"><h2>OTP Anda:</h2><h1 style="color: #8b5cf6;">${otp}</h1></div>`
        });
        res.status(200).json({ success: true, email: email, redirectUrl: `/verify-otp?email=${encodeURIComponent(email)}` });
    } catch (err) { res.status(500).json({ success: false, message: 'Gagal memproses pendaftaran.' }); }
});

router.get('/verify-otp', (req, res) => {
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) return res.redirect('/dardcorchat/dardcor-ai');
    res.render('verify', { email: req.query.email });
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { data: record } = await supabase.from('verification_codes').select('*').eq('email', req.body.email).eq('otp', req.body.otp).single();
        if (!record) return res.status(400).json({ success: false, message: "Kode OTP Salah!" });

        const { data: newUser } = await supabase.from('dardcor_users').insert([{ username: record.username, email: record.email, password: record.password }]).select().single();
        await supabase.from('verification_codes').delete().eq('email', req.body.email);
        
        req.session.userAccount = newUser;
        const tenYears = 1000 * 60 * 60 * 24 * 365 * 10;
        req.session.cookie.expires = new Date(Date.now() + tenYears);
        req.session.cookie.maxAge = tenYears;
        res.cookie('dardcor_uid', newUser.id, { maxAge: tenYears, httpOnly: true, secure: true, sameSite: 'lax' });

        req.session.save(() => { res.status(200).json({ success: true, message: "Akun berhasil dibuat!", redirectUrl: '/dardcorchat/dardcor-ai' }); });
    } catch (err) { res.status(500).json({ success: false, message: "Terjadi kesalahan server." }); }
});

router.get('/dardcorchat/profile', checkUserAuth, (req, res) => {
    res.render('dardcorchat/profile', { user: req.session.userAccount, success: null, error: null });
});

router.post('/dardcor/profile/update', checkUserAuth, upload.single('profile_image'), async (req, res) => {
    const userId = req.session.userAccount.id;
    let updates = { username: req.body.username };
    try {
        if (req.body.password && req.body.password.trim() !== "") {
            if (req.body.password !== req.body.confirm_password) return res.render('dardcorchat/profile', { user: req.session.userAccount, error: "Password tidak sama.", success: null });
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
        req.session.save(() => { res.render('dardcorchat/profile', { user: data, success: "Profil diperbarui!", error: null }); });
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
        if (!activeId || activeId.length < 10) { activeId = uuidv4(); return res.redirect(`/dardcorchat/dardcor-ai/${activeId}`); }
        const { data: activeChatHistory } = await supabase.from('history_chat').select('*').eq('conversation_id', activeId).order('created_at', { ascending: true });
        req.session.currentConversationId = activeId;
        res.render('dardcorchat/layout', {
            user: req.session.userAccount,
            chatHistory: activeChatHistory || [],
            conversationList: conversationList || [],
            activeConversationId: activeId,
            toolType: toolType,
            contentPage: 'dardcorai' 
        });
    } catch (err) { res.redirect('/dardcor'); }
});

router.get('/api/chat/:conversationId', checkUserAuth, async (req, res) => {
    const userId = req.session.userAccount.id;
    try {
        const { data: history } = await supabase.from('history_chat').select('*').eq('conversation_id', req.params.conversationId).eq('user_id', userId).order('created_at', { ascending: true });
        req.session.currentConversationId = req.params.conversationId; req.session.save();
        res.json({ success: true, history: history || [] });
    } catch (err) { res.status(500).json({ success: false }); }
});

router.post('/dardcorchat/ai/new-chat', checkUserAuth, (req, res) => {
    req.session.currentConversationId = null;
    req.session.save(() => { res.json({ success: true, redirectUrl: `/dardcorchat/dardcor-ai/${uuidv4()}` }); });
});

router.post('/dardcorchat/ai/rename-chat', checkUserAuth, async (req, res) => {
    try { await supabase.from('conversations').update({ title: req.body.newTitle }).eq('id', req.body.conversationId).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); }
});

router.post('/dardcorchat/ai/delete-chat-history', checkUserAuth, async (req, res) => {
    try { await supabase.from('conversations').delete().eq('id', req.body.conversationId).eq('user_id', req.session.userAccount.id); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); }
});

router.post('/dardcorchat/ai/store-preview', checkUserAuth, async (req, res) => {
    const previewId = uuidv4();
    try { await supabase.from('previews_website').insert({ id: previewId, user_id: req.session.userAccount.id, code: req.body.code }); res.json({ success: true, previewId }); } catch (error) { res.status(500).json({ success: false }); }
});

router.get('/dardcorchat/dardcor-ai/preview/:id', checkUserAuth, async (req, res) => {
    try {
        const { data } = await supabase.from('previews_website').select('code').eq('id', req.params.id).single();
        if (!data) return res.status(404).send('Not Found');
        res.setHeader('Content-Type', 'text/html'); res.send(data.code);
    } catch (err) { res.status(500).send("Error"); }
});

router.post('/dardcorchat/ai/chat-stream', checkUserAuth, uploadMiddleware, async (req, res) => {
    let message = req.body.message ? req.body.message.trim() : "";
    const uploadedFiles = req.files || [];
    const userId = req.session.userAccount.id;
    let conversationId = req.body.conversationId || uuidv4();
    const toolType = req.body.toolType || 'basic';
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.match(urlRegex);
        let systemContext = "";

        if (urls && urls.length > 0) {
            for (const url of urls) {
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    const ytData = await getYouTubeData(url);
                    if (ytData.success) {
                        systemContext += `\n[SYSTEM INFO - VIDEO SOURCE]:\nURL: ${url}\nJUDUL VIDEO: "${ytData.title}"\nDESKRIPSI VIDEO: "${ytData.description.substring(0, 2000)}..."\n`;
                        if (ytData.transcript && ytData.transcript.length > 50) {
                            systemContext += `ISI TRANSKRIP LENGKAP: "${ytData.transcript}"\n`;
                        } else {
                            systemContext += `(Transkrip tidak tersedia. Analisislah berdasarkan Judul dan Deskripsi diatas seakurat mungkin).\n`;
                        }
                    } else {
                        systemContext += `\n[SYSTEM INFO]: Gagal mengakses metadata YouTube untuk ${url}.\n`;
                    }
                } else {
                    const pageContent = await getWebsiteContent(url);
                    if (pageContent) {
                        systemContext += `\n[SYSTEM INFO - WEBSITE SOURCE]:\nURL: ${url}\nISI KONTEN: "${pageContent}"\n`;
                    }
                }
            }
            if (systemContext) {
                message = `${systemContext}\n\nPERTANYAAN USER: ${message}`;
            }
        }
    } catch (err) {
        console.log("Crawler Error:", err.message);
    }

    const hasFiles = uploadedFiles.length > 0;
    const userMessageDisplay = req.body.message || (hasFiles ? `Menganalisis ${uploadedFiles.length} file...` : "");

    try {
        const { data: convCheck } = await supabase.from('conversations').select('id').eq('id', conversationId).single();
        if (!convCheck) {
            await supabase.from('conversations').insert({ id: conversationId, user_id: userId, title: userMessageDisplay.substring(0, 30) || "Percakapan Baru" });
        } else {
            await supabase.from('conversations').update({ updated_at: new Date() }).eq('id', conversationId);
        }

        let fileMetadata = null;
        if (hasFiles) {
            fileMetadata = uploadedFiles.map(f => ({ filename: f.originalname, size: f.size, mimetype: f.mimetype }));
        }

        await supabase.from('history_chat').insert({
            user_id: userId, conversation_id: conversationId, role: 'user', message: userMessageDisplay, file_metadata: fileMetadata
        });
        
        const { data: historyData } = await supabase.from('history_chat').select('role, message').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        
        const stream = await handleChatStream(message, uploadedFiles, historyData, toolType);
        let fullResponse = "";

        for await (const chunk of stream) {
            const chunkText = chunk.text();
            fullResponse += chunkText;
            res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
        }

        if (fullResponse) {
            await supabase.from('history_chat').insert({ user_id: userId, conversation_id: conversationId, role: 'bot', message: fullResponse });
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

    } catch (error) {
        console.log(error);
        res.write(`data: ${JSON.stringify({ error: "Gagal memproses AI." })}\n\n`);
        res.end();
    }
});

module.exports = router;