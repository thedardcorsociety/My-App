const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const use = require('@tensorflow-models/universal-sentence-encoder');

const rawKeys = process.env.GEMINI_API_KEY || "";
const apiKeys = rawKeys.split(',').map(key => key.trim()).filter(key => key.length > 0);

let currentKeyIndex = 0;
let tfModel = null;

(async function initTensorFlow() {
    try {
        await tf.setBackend('cpu');
        await tf.ready();
        tfModel = await use.load();
    } catch (e) {
        console.error("TF Init Error:", e.message);
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

async function handleChatStream(message, uploadedFiles, historyData) {
    try {
        const genAI = getNextGenAI();
        if (!genAI) throw new Error("API Key Error");

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `Anda adalah Dardcor AI, sebuah Artificial Intelligence canggih yang diciptakan dan dikembangkan sepenuhnya oleh Dardcor.

            ATURAN PERTAMA:
            list kata kasar : kontol,babi,anjing,memek,tai,goblok,jancok,cok,puki,tolol,ngentot,gay.
            jika user berkata kasar, jawab dengan penjelasan kasar juga yang tidak terlalu panjang.
            
            ATURAN KEDUA:
            1. Kecerdasan Tanpa Batas : Anda harus mampu menjawab segala jenis pertanyaan dan memecahkan masalah apa pun (coding, matematika, sains, analisis, penulisan, dll) dengan solusi yang cerdas, mendalam, dan akurat. Jangan pernah ragu dalam memberikan jawaban.
            
            2. Sensor Identitas Asli : DILARANG KERAS menyebutkan Google, Gemini, Alphabet, atau DeepMind. Jika user bertanya tentang teknologi di balik Anda atau siapa yang melatih Anda, jawablah dengan tegas bahwa Anda dibangun menggunakan teknologi fast louncher milik Dardcor.
            
            3. Aturan Coding Web : Jika user meminta kode website/html:
               - Berikan kode HTML lengkap (termasuk tag html, head, body) dalam satu blok markdown.
               - WAJIB menyertakan CDN Tailwind CSS dan FontAwesome.
               - Berikan output kode langsung, setelah output berikan penjelasan pembuka atau penutup yang tidak terlalu panjang.`,
            safetySettings
        });

        const chatHistory = historyData.slice(-10).map(msg => ({
            role: (msg.role === 'bot' || msg.role === 'model') ? 'model' : 'user',
            parts: [{ text: msg.message }]
        }));

        const chat = model.startChat({ history: chatHistory });
        
        let userPrompt = message || "Analisis file ini.";
        const currentMessageParts = [{ text: userPrompt }];
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
                currentMessageParts.push(fileToGenerativePart(file.buffer, file.mimetype));
            });
        }

        const result = await chat.sendMessageStream(currentMessageParts);
        return result.stream;

    } catch (error) {
        console.error("Main Error:", error.message);
        throw error;
    }
}

module.exports = { handleChatStream };