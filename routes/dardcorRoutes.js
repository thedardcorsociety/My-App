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

function checkUserAuth(req, res, next) {
    if (req.session && req.session.userAccount) {
        return next();
    }
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

router.get('/', (req, res) => {
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcor-ai');
    res.render('index', { user: null });
});

router.get('/dardcor', (req, res) => { 
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcor-ai'); 
    res.render('dardcor', { error: null }); 
});

router.get('/register', (req, res) => { 
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcor-ai');
    res.render('register', { error: null }); 
});

router.post('/dardcor-login', authLimiter, async (req, res) => {
    let { email, password } = req.body;
    try {
        const { data: user } = await supabase.from('dardcor_users').select('*').eq('email', email.trim().toLowerCase()).single();
        if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ success: false, message: 'Login gagal.' });
        
        req.session.userAccount = user;
        req.session.save((err) => {
            if (err) return res.status(500).json({ success: false, message: 'Gagal memproses login.' });
            res.status(200).json({ success: true, redirectUrl: '/dardcorchat/dardcor-ai' });
        });
    } catch (err) { 
        res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem.' }); 
    }
});

router.get('/dardcor-logout', (req, res) => { 
    req.session.destroy((err) => {
        res.clearCookie('connect.sid');
        res.redirect('/dardcor'); 
    });
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
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcor-ai');
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
        req.session.save(() => {
             res.status(200).json({ success: true, message: "Akun berhasil dibuat!", redirectUrl: '/dardcorchat/dardcor-ai' });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
    }
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