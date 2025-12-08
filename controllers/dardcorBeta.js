// controllers/dardcorBeta.js
const axios = require('axios');

async function handleBetaChat(message, uploadedFile, historyData) {
    try {
        // PERBAIKAN DI SINI: Ganti 3000 menjadi 3001
        // Karena Project API kamu berjalan di port 3001
        const API_URL = 'https://dardcor-api.vercel.app//api/chat-local'; 

        console.log(`[Dardcor Beta] Mengirim pesan ke: ${API_URL}`);

        const response = await axios.post(API_URL, {
            message: message
        });

        if (response.data && response.data.reply) {
            return response.data.reply;
        } else {
            return "🤖 [Dardcor Beta]: Server merespon, tapi tidak ada jawaban.";
        }
        
    } catch (error) {
        console.error("Error ke API:", error.message);
        
        // Pesan error yang lebih jelas
        if (error.code === 'ECONNREFUSED') {
            return "⚠️ [Error]: Server API (Port 3001) mati atau belum dijalankan.";
        }
        
        return "🤖 [Dardcor Beta]: Gagal menghubungi API (Cek Terminal Project API).";
    }
}

module.exports = { handleBetaChat };