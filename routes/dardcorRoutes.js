const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const supabase = require('../config/supabase'); 
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const { handleChat } = require('../controllers/dardcorModel');

const storage = multer.memoryStorage();
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
    upload.single('file_attachment')(req, res, function (err) {
        if (err) return res.status(400).json({ success: false, response: "File terlalu besar (Max 10MB)." });
        next();
    });
};

router.get('/', (req, res) => {
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcorai');
    res.render('index', { user: null });
});

router.get('/dardcor', (req, res) => { 
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcorai'); 
    res.render('dardcor', { error: null }); 
});

router.get('/register', (req, res) => { 
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcorai');
    res.render('register', { error: null }); 
});

router.post('/dardcor-login', authLimiter, async (req, res) => {
    let { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email dan Password wajib diisi." });
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    try {
        const { data: user, error } = await supabase.from('dardcor_users').select('*').eq('email', email).single();
        
        if (error || !user) {
            return res.status(400).json({ success: false, message: 'Email tidak terdaftar.' });
        }
        
        const match = await bcrypt.compare(password, user.password);

        if (match) { 
            req.session.userAccount = user;
            req.session.save((err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Gagal memproses login.' });
                }
                res.status(200).json({ success: true, redirectUrl: '/dardcorchat/dardcorai' });
            });
        } else { 
            res.status(400).json({ success: false, message: 'Password salah.' }); 
        }
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

router.post('/register', authLimiter, [
    body('username').trim().escape().isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Format input tidak valid.' });

    let { username, email, password } = req.body;
    email = email.trim().toLowerCase();
    password = password.trim();

    try {
        const { data: existingUser } = await supabase.from('dardcor_users').select('email').eq('email', email).single();
        if (existingUser) return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });

        await supabase.from('verification_codes').delete().eq('email', email);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 12);

        const { error: saveError } = await supabase.from('verification_codes').insert([{
            username, email, password: hashedPassword, otp
        }]);

        if (saveError) throw saveError;

        const mailOptions = {
            from: '"Dardcor Security" <no-reply@dardcor.com>',
            to: email,
            subject: 'Kode Verifikasi Dardcor AI',
            html: `<div style="font-family: sans-serif; padding:20px;"><h2>OTP Anda:</h2><h1 style="color: #8b5cf6;">${otp}</h1></div>`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, email: email, redirectUrl: `/verify-otp?email=${encodeURIComponent(email)}` });

    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal memproses pendaftaran.' });
    }
});

router.get('/verify-otp', (req, res) => {
    if (req.session && req.session.userAccount) return res.redirect('/dardcorchat/dardcorai');
    const email = req.query.email;
    if (!email) return res.redirect('/register');
    res.render('verify', { email: email });
});

router.post('/verify-otp', async (req, res) => {
    let { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ success: false, message: "Data tidak lengkap." });
    
    email = email.trim().toLowerCase();
    otp = otp.trim();
    
    try {
        const { data: record, error: otpError } = await supabase.from('verification_codes').select('*').eq('email', email).eq('otp', otp).single();

        if (otpError || !record) return res.status(400).json({ success: false, message: "Kode OTP Salah!" });

        const { data: newUser, error: insertError } = await supabase.from('dardcor_users').insert([{ 
            username: record.username, 
            email: record.email, 
            password: record.password 
        }]).select().single();

        if (insertError) throw new Error("Gagal menyimpan user.");

        await supabase.from('verification_codes').delete().eq('email', email);
        
        req.session.userAccount = newUser;
        req.session.save((err) => {
             if (err) return res.status(500).json({ success: false, message: "Gagal membuat sesi." });
             return res.status(200).json({ 
                success: true, 
                message: "Akun berhasil dibuat!",
                redirectUrl: '/dardcorchat/dardcorai'
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
    }
});

router.get('/dardcorchat/profile', checkUserAuth, (req, res) => {
    res.render('dardcorchat/profile', { user: req.session.userAccount, success: null, error: null });
});

router.post('/dardcor/profile/update', checkUserAuth, upload.single('profile_image'), async (req, res) => {
    const { username, password, confirm_password } = req.body;
    const userId = req.session.userAccount.id;
    let updates = { username: username };
    try {
        if (password && password.trim() !== "") {
            if (password !== confirm_password) return res.render('dardcorchat/profile', { user: req.session.userAccount, error: "Password tidak sama.", success: null });
            updates.password = await bcrypt.hash(password.trim(), 12);
        }
        if (req.file) {
            const fileName = `${userId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
            const { error: upErr } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
            
            if (!upErr) {
                const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
                updates.profile_image = publicData.publicUrl;
            }
        }
        
        const { data, error } = await supabase.from('dardcor_users').update(updates).eq('id', userId).select().single();
        if (error) throw error;
        
        req.session.userAccount = data;
        req.session.save(() => {
            res.render('dardcorchat/profile', { user: data, success: "Profil diperbarui!", error: null });
        });
        
    } catch (err) { 
        res.render('dardcorchat/profile', { user: req.session.userAccount, error: err.message, success: null }); 
    }
});

router.get('/dardcorchat/dardcorai', checkUserAuth, (req, res) => { loadChatHandler(req, res); });
router.get('/dardcorchat/dardcor-ai/:conversationId', checkUserAuth, loadChatHandler);

async function loadChatHandler(req, res) {
    const userId = req.session.userAccount.id;
    const requestedId = req.params.conversationId;
    
    try {
        const { data: dbHistory } = await supabase.from('history_chat').select('*').eq('user_id', userId).order('created_at', { ascending: true });
        
        let activeId = requestedId || uuidv4();
        req.session.currentConversationId = activeId;
        
        let activeChatHistory = dbHistory ? dbHistory.filter(item => item.conversation_id === activeId && item.message !== null) : [];
        
        const historyMap = new Map();
        if (dbHistory) {
            dbHistory.forEach(chat => {
                if (!historyMap.has(chat.conversation_id) && chat.message !== null) {
                    historyMap.set(chat.conversation_id, { 
                        conversation_id: chat.conversation_id, 
                        message: chat.message, 
                        last_activity: chat.created_at 
                    });
                }
            });
        }
        const fullHistorySorted = Array.from(historyMap.values()).sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
        
        res.render('dardcorchat/dardcorai', {
            user: req.session.userAccount,
            chatHistory: activeChatHistory,
            fullHistory: fullHistorySorted,
            activeConversationId: activeId
        });
    } catch (err) {
        res.render('dardcorchat/dardcorai', { 
            user: req.session.userAccount, 
            chatHistory: [], 
            fullHistory: [], 
            activeConversationId: uuidv4() 
        });
    }
}

router.post('/dardcorchat/ai/new-chat', checkUserAuth, (req, res) => {
    req.session.currentConversationId = null;
    req.session.save(() => {
        res.json({ success: true, redirectUrl: `/dardcorchat/dardcor-ai/${uuidv4()}` });
    });
});

router.post('/dardcorchat/ai/rename-chat', checkUserAuth, async (req, res) => {
    try {
        await supabase.from('history_chat').update({ message: req.body.newTitle })
            .eq('conversation_id', req.body.conversationId)
            .eq('user_id', req.session.userAccount.id)
            .eq('role', 'user')
            .order('created_at', { ascending: true }).limit(1);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

router.post('/dardcorchat/ai/delete-chat-history', checkUserAuth, async (req, res) => {
    try {
        await supabase.from('history_chat').delete().eq('conversation_id', req.body.conversationId).eq('user_id', req.session.userAccount.id);
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

router.post('/dardcorchat/ai/chat', checkUserAuth, uploadMiddleware, async (req, res) => {
    const message = req.body.message ? req.body.message.trim() : "";
    const uploadedFile = req.file;
    const userId = req.session.userAccount.id;
    let conversationId = req.body.conversationId || req.session.currentConversationId || uuidv4();
    
    const userMessage = message || (uploadedFile ? "Menganalisis file..." : "");
    if (!userMessage) return res.json({ success: false, response: "Input kosong." });
    
    try {
        await supabase.from('history_chat').insert({
            user_id: userId, conversation_id: conversationId, role: 'user', message: userMessage,
            file_metadata: uploadedFile ? { filename: uploadedFile.originalname, size: uploadedFile.size } : null
        });
        
        const { data: historyData } = await supabase.from('history_chat').select('role, message').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        const botResponse = await handleChat(message, uploadedFile, historyData);
        
        if (botResponse) {
            await supabase.from('history_chat').insert({ user_id: userId, conversation_id: conversationId, role: 'bot', message: botResponse });
            res.json({ success: true, response: botResponse, conversationId });
        } else { 
            throw new Error("AI tidak memberikan respon."); 
        }
    } catch (error) { 
        res.status(500).json({ success: false, response: "Terjadi gangguan sistem." }); 
    }
});

module.exports = router;