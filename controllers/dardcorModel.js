const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const use = require('@tensorflow-models/universal-sentence-encoder');
const { knowledgeBase } = require('../utils/knowledge');

const rawKeys = process.env.GEMINI_API_KEY || "";
const apiKeys = rawKeys.split(',').map(key => key.trim()).filter(key => key.length > 0);

let currentKeyIndex = 0;
let tfModel = null;
let knowledgeTensor = null; 
let responseMap = [];

(async function initTensorFlow() {
    try {
        await tf.setBackend('cpu');
        await tf.ready();
        tfModel = await use.load();
        
        const allInputs = [];
        responseMap = [];

        knowledgeBase.forEach(item => {
            item.inputs.forEach(inputMsg => {
                allInputs.push(inputMsg);
                responseMap.push(item.output);
            });
        });
        
        const embeddings = await tfModel.embed(allInputs);
        knowledgeTensor = tf.keep(embeddings);
    } catch (e) {
        console.error(e);
    }
})();

function getNextGenAI() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenerativeAI(key);
}

function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType
        }
    };
}

async function handleChat(message, uploadedFile, historyData, toolType = 'chat') {
    try {
        if (!message && !uploadedFile) return "Input kosong.";

        // --- IMAGE GENERATION LOGIC ---
        if (toolType === 'image') {
            const promptEncoded = encodeURIComponent(message);
            // Menggunakan Pollinations AI untuk generate gambar tanpa API Key
            const imageUrl = `https://image.pollinations.ai/prompt/${promptEncoded}`;
            return `Berikut adalah gambar "${message}" yang Anda minta:\n\n![Generated Image](${imageUrl})`;
        }

        // --- VIDEO GENERATION LOGIC ---
        if (toolType === 'video') {
            // Placeholder karena video generation butuh API berbayar/berat
            return `Maaf, saat ini server pembuatan video sedang sibuk atau memerlukan API Key khusus (seperti Replicate/Runway). \n\nSaya merekomendasikan untuk menggunakan fitur **Create Image** terlebih dahulu yang sudah stabil.`;
        }

        // --- NORMAL CHAT LOGIC ---
        if (message && !uploadedFile && tfModel && knowledgeTensor) {
            try {
                const inputTensor = await tfModel.embed([message.toLowerCase()]);
                const result = tf.tidy(() => {
                    const products = tf.matMul(inputTensor, knowledgeTensor, false, true);
                    const maxScore = products.max();
                    const maxIndex = products.argMax(1);
                    return {
                        score: maxScore.dataSync()[0],
                        index: maxIndex.dataSync()[0]
                    };
                });
                
                inputTensor.dispose();

                if (result.score > 0.75) {
                    return responseMap[result.index];
                }
            } catch (err) {}
        }

        const genAI = getNextGenAI();
        if (!genAI) return "Error: API Key tidak ditemukan.";

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
            const recentMessages = historyData.slice(-20); 
            
            recentMessages.forEach(msg => {
                if (!msg.message || msg.message.trim() === "") return;
                const role = (msg.role === 'bot' || msg.role === 'model') ? 'model' : 'user';
                
                if (lastRole === role) {
                    chatHistory[chatHistory.length - 1].parts[0].text += "\n" + msg.message;
                } else {
                    chatHistory.push({ role: role, parts: [{ text: msg.message }] });
                }
                lastRole = role;
            });
        }

        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.pop();
        }

        const chat = model.startChat({
            history: chatHistory
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
        return "Maaf, sistem sedang sibuk. Coba lagi nanti.";
    }
}

module.exports = { handleChat };