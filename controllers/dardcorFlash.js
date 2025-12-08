// controllers/dardcorFlash.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

function fileToGenerativePart(buffer, mimeType) {
    return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

async function handleFlashChat(message, uploadedFile, historyData) {
    try {
        // 1. Format History khusus untuk Gemini
        let formattedHistory = [];
        if (historyData && historyData.length > 1) {
            const previousChats = historyData.slice(0, -1); // Exclude pesan terakhir (current)
            let lastRole = null;
            
            previousChats.forEach(msg => {
                let role = msg.role === 'bot' ? 'model' : 'user';
                let text = msg.message || " ";
                
                // Gemini tidak suka role yang berulang (User -> User), gabungkan jika terjadi
                if (role === lastRole && formattedHistory.length > 0) {
                    formattedHistory[formattedHistory.length - 1].parts[0].text += "\n" + text;
                } else {
                    formattedHistory.push({ role: role, parts: [{ text: text }] });
                }
                lastRole = role;
            });

            // Pastikan history dimulai dari user dan tidak diakhiri user (clean up)
            if (formattedHistory.length > 0) {
                if (formattedHistory[0].role !== 'user') formattedHistory.shift();
                if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role !== 'model') {
                    formattedHistory.pop();
                }
            }
        }

        // 2. Inisialisasi Model
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "Anda adalah Dardcor AI Flash, asisten AI yang cepat dan cerdas.",
        });

        // 3. Mulai Chat
        const chat = model.startChat({ history: formattedHistory });
        
        const parts = [];
        if(uploadedFile) {
            parts.push(fileToGenerativePart(uploadedFile.buffer, uploadedFile.mimetype));
        }
        parts.push({ text: message || "Jelaskan tentang file ini." });

        const result = await chat.sendMessage(parts);
        return result.response.text();

    } catch (error) {
        throw error; // Lempar error ke routes utama untuk ditangani
    }
}

module.exports = { handleFlashChat };