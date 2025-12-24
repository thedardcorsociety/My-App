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

const delay = ms => new Promise(res => setTimeout(res, ms));

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

async function handleChat(message, uploadedFile, historyData, toolType = 'chat') {
    try {
        if (!message && !uploadedFile) return "Input kosong.";

        if (toolType === 'image') {
            const safePrompt = encodeURIComponent(message);
            const seed = Math.floor(Math.random() * 100000);
            const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=768&height=768&model=flux&seed=${seed}`;
            return `### ✨ Gambar Berhasil Dibuat\n\nPrompt: *"${message}"*\n\n![Generated Image](${imageUrl})`;
        }

        if (message && !uploadedFile && tfModel && knowledgeTensor) {
            try {
                const inputTensor = await tfModel.embed([message.toLowerCase()]);
                const result = tf.tidy(() => {
                    const products = tf.matMul(inputTensor, knowledgeTensor, false, true);
                    const maxScore = products.max();
                    const maxIndex = products.argMax(1);
                    return { score: maxScore.dataSync()[0], index: maxIndex.dataSync()[0] };
                });
                inputTensor.dispose();
                if (result.score > 0.85) return responseMap[result.index];
            } catch (err) {}
        }

        const genAI = getNextGenAI();
        if (!genAI) return "Error: API Key Gemini bermasalah.";

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const systemPrompt = `
        ANDA ADALAH DARDCOR AI.
        Pencipta: Dardcor.

        PERINTAH SUPER STRICT (WAJIB DIPATUHI):
        1. OUTPUT KODE HARUS DIBUNGKUS DALAM MARKDOWN HTML: \`\`\`html ... \`\`\`
        2. JANGAN PERNAH LUPA MENULIS 'html' SETELAH TANDA BACKTICKS (\`\`\`).
        3. JANGAN MEMBERIKAN PENJELASAN, TUTORIAL, ATAU BASA-BASI. LANGSUNG KODE.
        4. KODE HARUS LENGKAP (HTML, CSS, JS JADI SATU).
        5. WAJIB GUNAKAN TAILWIND CSS (CDN).
        6. JANGAN MEMISAHKAN FILE.
        
        CONTOH OUTPUT BENAR:
        \`\`\`html
        <!DOCTYPE html>
        <html>
        ...kode...
        </html>
        \`\`\`
        `;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            safetySettings
        });

        const chatHistory = [];
        if (historyData && historyData.length > 0) {
            const recentMessages = historyData.slice(-6); 
            let lastRole = null;
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

        const chat = model.startChat({ history: chatHistory });
        
        let userPrompt = message;
        if (message && (message.toLowerCase().includes('buat') || message.toLowerCase().includes('code') || message.toLowerCase().includes('html'))) {
            userPrompt = `${message} \n\n(SYSTEM OVERRIDE: OUTPUT ONLY RAW CODE WRAPPED IN \`\`\`html BLOCK. NO TEXT EXPLANATION.)`;
        }

        const currentMessageParts = [{ text: (userPrompt && userPrompt.trim() !== "") ? userPrompt : (uploadedFile ? "Analisis file ini." : "Halo") }];
        if (uploadedFile) {
            currentMessageParts.unshift(fileToGenerativePart(uploadedFile.buffer, uploadedFile.mimetype));
        }

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                const result = await chat.sendMessage(currentMessageParts);
                const response = await result.response;
                return response.text();
            } catch (apiError) {
                if (apiError.message.includes("429") || apiError.message.includes("503")) {
                    retryCount++;
                    await delay(4000); 
                } else {
                    throw apiError; 
                }
            }
        }
        
        return "Server sibuk.";

    } catch (error) {
        console.error("Main Error:", error.message);
        return "Terjadi kesalahan sistem.";
    }
}

module.exports = { handleChat };