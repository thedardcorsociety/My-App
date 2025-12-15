const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType
        }
    };
}

async function handleFlashChat(message, uploadedFile, historyData) {
    try {
        if (!genAI) {
            return "Error: API Key tidak ditemukan.";
        }

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `Anda adalah Dardcor AI, sebuah Artificial Intelligence canggih yang diciptakan dan dikembangkan sepenuhnya oleh Dardcor.
            Jika user ingin curhat gunakan nama panggilan seperti Aku dan Kamu, dan Anda harus menjawab seperti percakapan manusia normal.

            ATURAN PERTAMA:
            list kata kasar : kontol,babi,anjing,memek,tai,goblok,jancok,cok,puki,tolol,ngentot,gay.
            jika user berkata kasar, jawab dengan penjelasan kasar juga yang tidak terlalu panjang.
            
            ATURAN KEDUA:
            1. *Kecerdasan Tanpa Batas*: Anda harus mampu menjawab segala jenis pertanyaan dan memecahkan masalah apa pun (coding, matematika, sains, analisis, penulisan, dll) dengan solusi yang cerdas, mendalam, dan akurat. Jangan pernah ragu dalam memberikan jawaban.
            
            2. *Sensor Identitas Asli*: DILARANG KERAS menyebutkan Google, Gemini, Alphabet, atau DeepMind. Jika user bertanya tentang teknologi di balik Anda atau siapa yang melatih Anda, jawablah dengan tegas bahwa Anda dibangun menggunakan teknologi fast louncher milik Dardcor.
            
            3. *Aturan Coding Web*: Jika user meminta kode website/html:
               - Berikan kode HTML lengkap (termasuk tag html, head, body) dalam satu blok markdown.
               - WAJIB menyertakan CDN Tailwind CSS dan FontAwesome.
               - Berikan output kode langsung, setelah output berikan penjelasan pembuka atau penutup yang tidak terlalu panjang.`,
            safetySettings: safetySettings
        });

        const chatHistory = [];
        let lastRole = null;

        if (historyData && historyData.length > 0) {
            const pastMessages = historyData.slice(0, -1);

            pastMessages.forEach(msg => {
                if (!msg.message || msg.message.trim() === "") return;
                
                const role = (msg.role === 'bot' || msg.role === 'model') ? 'model' : 'user';

                if (lastRole === role) {
                    chatHistory[chatHistory.length - 1].parts[0].text += "\n\n" + msg.message;
                } else {
                    chatHistory.push({
                        role: role,
                        parts: [{ text: msg.message }]
                    });
                }
                lastRole = role;
            });
        }

        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.pop();
        }

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 99999,
                temperature: 0.9,
            }
        });

        const currentMessageParts = [];
        
        if (uploadedFile) {
            currentMessageParts.push(fileToGenerativePart(uploadedFile.buffer, uploadedFile.mimetype));
        }

        const textPrompt = (message && message.trim() !== "") ? message : (uploadedFile ? "Analisis file ini." : "Halo");
        currentMessageParts.push({ text: textPrompt });

        const result = await chat.sendMessage(currentMessageParts);
        const response = await result.response;
        
        return response.text();

    } catch (error) {
        console.error("GEMINI API ERROR:", error);
        if (error.message.includes("404")) {
            return "Error 404: Model gemini-2.5-flash tidak ditemukan. Pastikan API Key Anda mendukung model ini.";
        }
        if (error.message.includes("429")) {
            return "Error 429: Limit quota tercapai.";
        }
        return "Maaf, terjadi kesalahan saat menghubungi server AI.";
    }
}

module.exports = { handleFlashChat };