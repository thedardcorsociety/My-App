const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const supabase = require('../config/supabase'); 
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { handleChatStream } = require('../controllers/dardcorModel');

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    message: "Terlalu banyak percobaan. Silakan coba lagi nanti."
});

// --- HELPER: Baca Cookie Manual (Untuk backup jika cookie-parser belum ada) ---
function getCookie(req, name) {
    if (req.cookies && req.cookies[name]) return req.cookies[name];
    if (!req.headers.cookie) return null;
    const value = `; ${req.headers.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// --- MIDDLEWARE: Cek Auth dengan Auto-Restore Sesi ---
async function checkUserAuth(req, res, next) {
    // 1. Cek apakah sesi masih hidup di memori server
    if (req.session && req.session.userAccount) {
        return next();
    }

    // 2. Jika sesi mati (karena close app/server restart), Cek Cookie Backup 'dardcor_uid'
    const userId = getCookie(req, 'dardcor_uid');
    
    if (userId) {
        try {
            // Restore data user dari Supabase secara diam-diam
            const { data: user } = await supabase
                .from('dardcor_users')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (user) {
                // Hidupkan kembali sesi server
                req.session.userAccount = user;
                
                // Perbarui durasi sesi jadi 10 tahun lagi
                const tenYears = 1000 * 60 * 60 * 24 * 365 * 10;
                req.session.cookie.expires = new Date(Date.now() + tenYears);
                req.session.cookie.maxAge = tenYears;

                return req.session.save(() => next());
            }
        } catch (e) {
            // Jika gagal restore, biarkan lanjut ke redirect login
        }
    }

    // 3. Jika tidak ada sesi DAN tidak ada cookie backup -> Redirect Login
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ success: false, redirectUrl: '/dardcor' });
    }
    res.redirect('/dardcor');
}

const uploadMiddleware = (req, res, next) => {
    upload.array('file_attachment', 5)(req, res, function (err) {
        if (err) return res.status(400).json({ success: false, response: "Max 5 File (@10MB)." });
        next();
    });
};

// --- ROUTES HALAMAN UTAMA ---

router.get('/', (req, res) => {
    // Cek cookie manual di sini juga agar tidak redirect ke login jika punya cookie
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) {
        return res.redirect('/dardcorchat/dardcor-ai');
    }
    res.render('index', { user: null });
});

router.get('/dardcor', (req, res) => { 
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) {
        return res.redirect('/dardcorchat/dardcor-ai'); 
    }
    res.render('dardcor', { error: null }); 
});

router.get('/register', (req, res) => { 
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) {
        return res.redirect('/dardcorchat/dardcor-ai');
    }
    res.render('register', { error: null }); 
});

// --- LOGIN PROCESS ---

router.post('/dardcor-login', authLimiter, async (req, res) => {
    let { email, password } = req.body;
    try {
        const { data: user } = await supabase.from('dardcor_users').select('*').eq('email', email.trim().toLowerCase()).single();
        if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ success: false, message: 'Login gagal.' });
        
        req.session.userAccount = user;
        
        // 1. Setting Sesi Server (10 Tahun)
        const tenYears = 1000 * 60 * 60 * 24 * 365 * 10;
        req.session.cookie.expires = new Date(Date.now() + tenYears);
        req.session.cookie.maxAge = tenYears;

        // 2. Setting Cookie Browser Permanen (BACKUP UTAMA)
        // Ini akan tetap ada di HP user walaupun aplikasi ditutup total
        res.cookie('dardcor_uid', user.id, { 
            maxAge: tenYears, 
            httpOnly: true, 
            secure: true, // Pastikan true jika di Vercel/HTTPS
            sameSite: 'lax'
        });

        req.session.save((err) => {
            if (err) return res.status(500).json({ success: false, message: 'Gagal memproses login.' });
            res.status(200).json({ success: true, redirectUrl: '/dardcorchat/dardcor-ai' });
        });
    } catch (err) { 
        res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem.' }); 
    }
});

// --- LOGOUT PROCESS ---

router.get('/dardcor-logout', (req, res) => { 
    // Hapus Cookie Backup agar user benar-benar terlogout
    res.clearCookie('dardcor_uid');
    
    req.session.destroy((err) => {
        res.clearCookie('connect.sid');
        res.redirect('/dardcor'); 
    });
});

// --- REGISTER & OTP ---

router.post('/register', authLimiter, async (req, res) => {
    let { username, email, password } = req.body;
    email = email.trim().toLowerCase();
    try {
        const { data: existingUser } = await supabase.from('dardcor_users').select('email').eq('email', email).single();
        if (existingUser) return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });

        await supabase.from('verification_codes').delete().eq('email', email);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 12);

        await supabase.from('verification_codes').insert([{
            username, email, password: hashedPassword, otp
        }]);

        await transporter.sendMail({
            from: '"Dardcor Security" <no-reply@dardcor.com>',
            to: email,
            subject: 'Kode Verifikasi Dardcor AI',
            html: `<div style="font-family: sans-serif; padding:20px;"><h2>OTP Anda:</h2><h1 style="color: #8b5cf6;">${otp}</h1></div>`
        });

        res.status(200).json({ success: true, email: email, redirectUrl: `/verify-otp?email=${encodeURIComponent(email)}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal memproses pendaftaran.' });
    }
});

router.get('/verify-otp', (req, res) => {
    if ((req.session && req.session.userAccount) || getCookie(req, 'dardcor_uid')) {
        return res.redirect('/dardcorchat/dardcor-ai');
    }
    res.render('verify', { email: req.query.email });
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { data: record } = await supabase.from('verification_codes').select('*').eq('email', req.body.email).eq('otp', req.body.otp).single();
        if (!record) return res.status(400).json({ success: false, message: "Kode OTP Salah!" });

        const { data: newUser } = await supabase.from('dardcor_users').insert([{ 
            username: record.username, email: record.email, password: record.password 
        }]).select().single();

        await supabase.from('verification_codes').delete().eq('email', req.body.email);
        
        req.session.userAccount = newUser;

        // Setting Sesi & Cookie Backup (Sama seperti Login)
        const tenYears = 1000 * 60 * 60 * 24 * 365 * 10;
        req.session.cookie.expires = new Date(Date.now() + tenYears);
        req.session.cookie.maxAge = tenYears;

        res.cookie('dardcor_uid', newUser.id, { 
            maxAge: tenYears, 
            httpOnly: true, 
            secure: true,
            sameSite: 'lax'
        });

        req.session.save(() => {
             res.status(200).json({ success: true, message: "Akun berhasil dibuat!", redirectUrl: '/dardcorchat/dardcor-ai' });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
    }
});

// --- DASHBOARD & FITUR ---

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
        req.session.userAccount = data; // Update sesi dengan data baru
        
        req.session.save(() => {
            res.render('dardcorchat/profile', { user: data, success: "Profil diperbarui!", error: null });
        });
    } catch (err) { 
        res.render('dardcorchat/profile', { user: req.session.userAccount, error: err.message, success: null }); 
    }
});

router.get('/dardcorchat/dardcor-ai', checkUserAuth, (req, res) => {
    const newId = uuidv4();
    res.redirect(`/dardcorchat/dardcor-ai/${newId}`);
});

router.get('/dardcorchat/dardcor-ai/:conversationId', checkUserAuth, async (req, res) => {
    const userId = req.session.userAccount.id;
    const requestedId = req.params.conversationId;
    const toolType = req.params.toolType || 'chat';
    
    try {
        const { data: conversationList } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        let activeId = requestedId;
        if (!activeId || activeId.length < 10) {
            activeId = uuidv4();
            return res.redirect(`/dardcorchat/dardcor-ai/${activeId}`);
        }

        const { data: activeChatHistory } = await supabase
            .from('history_chat')
            .select('*')
            .eq('conversation_id', activeId)
            .order('created_at', { ascending: true });

        req.session.currentConversationId = activeId;
        
        res.render('dardcorchat/layout', {
            user: req.session.userAccount,
            chatHistory: activeChatHistory || [],
            conversationList: conversationList || [],
            activeConversationId: activeId,
            toolType: toolType,
            contentPage: 'dardcorai' 
        });
    } catch (err) {
        res.redirect('/dardcor');
    }
});

// --- API & CHAT STREAMING ---

router.get('/api/chat/:conversationId', checkUserAuth, async (req, res) => {
    const userId = req.session.userAccount.id;
    const conversationId = req.params.conversationId;

    try {
        const { data: history } = await supabase
            .from('history_chat')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
            
        req.session.currentConversationId = conversationId;
        req.session.save();

        res.json({ success: true, history: history || [] });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/dardcorchat/ai/new-chat', checkUserAuth, (req, res) => {
    req.session.currentConversationId = null;
    req.session.save(() => {
        res.json({ success: true, redirectUrl: `/dardcorchat/dardcor-ai/${uuidv4()}` });
    });
});

router.post('/dardcorchat/ai/rename-chat', checkUserAuth, async (req, res) => {
    try {
        await supabase.from('conversations')
            .update({ title: req.body.newTitle })
            .eq('id', req.body.conversationId)
            .eq('user_id', req.session.userAccount.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

router.post('/dardcorchat/ai/delete-chat-history', checkUserAuth, async (req, res) => {
    try {
        await supabase.from('conversations')
            .delete()
            .eq('id', req.body.conversationId)
            .eq('user_id', req.session.userAccount.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

router.post('/dardcorchat/ai/store-preview', checkUserAuth, async (req, res) => {
    const previewId = uuidv4();
    try {
        await supabase.from('previews_website').insert({ id: previewId, user_id: req.session.userAccount.id, code: req.body.code });
        res.json({ success: true, previewId });
    } catch (error) { res.status(500).json({ success: false }); }
});

router.get('/dardcorchat/dardcor-ai/preview/:id', checkUserAuth, async (req, res) => {
    try {
        const { data } = await supabase.from('previews_website').select('code').eq('id', req.params.id).single();
        if (!data) return res.status(404).send('Not Found');
        res.setHeader('Content-Type', 'text/html');
        res.send(data.code);
    } catch (err) { res.status(500).send("Error"); }
});

router.post('/dardcorchat/ai/chat-stream', checkUserAuth, uploadMiddleware, async (req, res) => {
    const message = req.body.message ? req.body.message.trim() : "";
    const uploadedFiles = req.files || [];
    const userId = req.session.userAccount.id;
    let conversationId = req.body.conversationId || uuidv4();
    const toolType = req.body.toolType || 'chat';
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const hasFiles = uploadedFiles.length > 0;
    const userMessage = message || (hasFiles ? `Menganalisis ${uploadedFiles.length} file...` : "");

    try {
        const { data: convCheck } = await supabase.from('conversations').select('id').eq('id', conversationId).single();
        if (!convCheck) {
            let title = message.substring(0, 30) || "Percakapan Baru";
            if (hasFiles) title = "Analisis File";
            await supabase.from('conversations').insert({ id: conversationId, user_id: userId, title: title });
        } else {
            await supabase.from('conversations').update({ updated_at: new Date() }).eq('id', conversationId);
        }

        let fileMetadata = null;
        if (hasFiles) {
            fileMetadata = uploadedFiles.map(f => ({ 
                filename: f.originalname, 
                size: f.size,
                mimetype: f.mimetype 
            }));
        }

        await supabase.from('history_chat').insert({
            user_id: userId, conversation_id: conversationId, role: 'user', message: userMessage,
            file_metadata: fileMetadata
        });
        
        const { data: historyData } = await supabase.from('history_chat')
            .select('role, message')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        
        // STREAMING LOGIC
        if (toolType === 'image') {
            const botResponse = await handleChatStream(message, uploadedFiles, historyData, toolType);
            res.write(`data: ${JSON.stringify({ chunk: botResponse })}\n\n`);
            
            await supabase.from('history_chat').insert({ 
                user_id: userId, conversation_id: conversationId, role: 'bot', message: botResponse 
            });
        } else {
            const stream = await handleChatStream(message, uploadedFiles, historyData, toolType);
            let fullResponse = "";

            for await (const chunk of stream) {
                const chunkText = chunk.text();
                fullResponse += chunkText;
                res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
            }

            if (fullResponse) {
                await supabase.from('history_chat').insert({ 
                    user_id: userId, conversation_id: conversationId, role: 'bot', message: fullResponse 
                });
            }
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