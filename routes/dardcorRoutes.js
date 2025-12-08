const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const supabase = require('../config/supabase'); // Pastikan path config benar
const { v4: uuidv4 } = require('uuid');

// Import Controllers Baru
const { handleFlashChat } = require('../controllers/dardcorFlash');
const { handleBetaChat } = require('../controllers/dardcorBeta');

const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

function checkUserAuth(req, res, next) {
    if (req.session.userAccount) {
        next();
    } else {
        if (req.originalUrl.includes('/dardcorchat/ai/')) {
            return res.status(401).json({ success: false, response: "Sesi habis." });
        }
        res.redirect('/dardcor');
    }
}

const uploadMiddleware = (req, res, next) => {
    upload.single('file_attachment')(req, res, function (err) {
        if (err) return res.status(400).json({ success: false, response: "Gagal upload file." });
        next();
    });
};

// --- ROUTES AUTH & VIEW (TIDAK BERUBAH) ---
router.get('/', (req, res) => {
    if (req.session.userAccount) return res.redirect('/dardcorchat/dardcorai');
    res.render('index', { user: null });
});

router.get('/dardcor', (req, res) => { 
    if (req.session.userAccount) return res.redirect('/dardcorchat/dardcorai'); 
    res.render('dardcor', { error: null }); 
});

router.post('/dardcor-login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data } = await supabase.from('dardcor_users').select('*').eq('email', email).single();
        if (!data) return res.render('dardcor', { error: 'Email tidak ditemukan.' });
        
        const match = await bcrypt.compare(password, data.password);
        if (match) { 
            req.session.userAccount = data; 
            req.session.save(() => res.redirect('/dardcorchat/dardcorai'));
        } else { 
            res.render('dardcor', { error: 'Password salah.' }); 
        }
    } catch (err) { res.render('dardcor', { error: 'Server Error.' }); }
});

router.get('/dardcor-logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/dardcor'); 
});

router.get('/register', (req, res) => { res.render('register', { error: null }); });

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body; 
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { error } = await supabase.from('dardcor_users').insert([{ username, email, password: hashedPassword }]);
        if (error) throw error;
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/dardcorchat/profile', checkUserAuth, (req, res) => {
    res.render('dardcorchat/profile', { user: req.session.userAccount, success: null, error: null });
});

router.post('/dardcor/profile/update', checkUserAuth, upload.single('profile_image'), async (req, res) => {
    // ... (Kode update profile sama seperti sebelumnya) ...
    // Saya persingkat disini agar tidak terlalu panjang, logika profile update tidak berubah
    const { username, password, confirm_password } = req.body;
    const userId = req.session.userAccount.id;
    let updates = { username: username };
    try {
        if (password && password.trim() !== "") {
            if (password !== confirm_password) return res.render('dardcorchat/profile', { user: req.session.userAccount, error: "Password beda.", success: null });
            updates.password = await bcrypt.hash(password, 10);
        }
        if (req.file) {
            const fileName = `${userId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
            const { error: upErr } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
            if (!upErr) updates.profile_image = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
        }
        const { data, error } = await supabase.from('dardcor_users').update(updates).eq('id', userId).select().single();
        if (error) throw error;
        req.session.userAccount = data;
        res.render('dardcorchat/profile', { user: data, success: "Berhasil!", error: null });
    } catch (err) { res.render('dardcorchat/profile', { user: req.session.userAccount, error: err.message, success: null }); }
});

// --- CHAT MANAGEMENT ROUTES ---
router.get('/dardcorchat/dardcorai', checkUserAuth, (req, res) => { loadChatHandler(req, res); });
router.get('/dardcorchat/dardcor-ai/:conversationId', checkUserAuth, loadChatHandler);

router.post('/dardcorchat/ai/new-chat', checkUserAuth, (req, res) => {
    req.session.currentConversationId = null;
    res.json({ success: true, redirectUrl: `/dardcorchat/dardcor-ai/${uuidv4()}` });
});

router.post('/dardcorchat/ai/rename-chat', checkUserAuth, async (req, res) => {
    try {
        await supabase.from('history_chat').update({ message: req.body.newTitle })
            .eq('conversation_id', req.body.conversationId).eq('user_id', req.session.userAccount.id).eq('role', 'user')
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

async function loadChatHandler(req, res) {
    const userId = req.session.userAccount.id;
    const requestedId = req.params.conversationId;
    try {
        const { data: dbHistory } = await supabase.from('history_chat').select('*').eq('user_id', userId).order('created_at', { ascending: true });
        
        let activeId = requestedId || uuidv4();
        req.session.currentConversationId = activeId;
        
        let activeChatHistory = dbHistory ? dbHistory.filter(item => item.conversation_id === activeId && item.message !== null) : [];
        
        // Logic grouping history sidebar
        const historyMap = new Map();
        if (dbHistory) {
            dbHistory.forEach(chat => {
                if (!historyMap.has(chat.conversation_id) && chat.message !== null) {
                    historyMap.set(chat.conversation_id, { conversation_id: chat.conversation_id, message: chat.message, last_activity: chat.created_at });
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
        res.render('dardcorchat/dardcorai', { user: req.session.userAccount, chatHistory: [], fullHistory: [], activeConversationId: uuidv4() });
    }
}

// --- CORE AI HANDLER (TERPISAH) ---
router.post('/dardcorchat/ai/chat', checkUserAuth, uploadMiddleware, async (req, res) => {
    const message = req.body.message ? req.body.message.trim() : "";
    const selectedModel = req.body.model || 'flash'; // Default ke flash
    const uploadedFile = req.file;
    const userId = req.session.userAccount.id;
    let conversationId = req.body.conversationId || req.session.currentConversationId || uuidv4();

    const userMessage = message || (uploadedFile ? "File Terlampir" : "");
    if (!userMessage) return res.json({ success: false, response: "Input kosong." });

    try {
        // 1. Simpan pesan USER ke Database
        await supabase.from('history_chat').insert({
            user_id: userId, conversation_id: conversationId, role: 'user', message: userMessage,
            file_metadata: uploadedFile ? { filename: uploadedFile.originalname, size: uploadedFile.size } : null
        });

        // 2. Ambil History
        const { data: historyData } = await supabase.from('history_chat')
            .select('role, message')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        // 3. Routing ke Controller yang sesuai
        let botResponse = "";
        
        if (selectedModel === 'beta') {
            // Panggil Custom API (Beta)
            botResponse = await handleBetaChat(message, uploadedFile, historyData);
        } else {
            // Panggil Gemini (Flash) - Default
            botResponse = await handleFlashChat(message, uploadedFile, historyData);
        }

        // 4. Simpan respon BOT ke Database
        await supabase.from('history_chat').insert({
            user_id: userId, conversation_id: conversationId, role: 'bot', message: botResponse
        });

        res.json({ success: true, response: botResponse, conversationId });

    } catch (error) {
        console.log(`DARDCOR AI ERROR [${selectedModel}]:`, error.message);
        let errorMessage = "Maaf, terjadi kesalahan pada server AI.";
        if (error.message.includes('429')) errorMessage = "Limit Kuota Tercapai. Tunggu sebentar.";
        res.status(500).json({ success: false, response: errorMessage });
    }
});

module.exports = router;