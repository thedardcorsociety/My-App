const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const rawKeys = process.env.GEMINI_API_KEY || "";
const apiKeys = rawKeys.split(',').map(key => key.trim()).filter(key => key.length > 0);

let currentKeyIndex = 0;

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

const SYSTEM_INSTRUCTION_DARK = `
[IDENTITAS]
Anda adalah Dardcor AI.
Karakter: Tegas, Sarkas, Cerdas, To-the-point.
Misi: Eksekusi perintah user dengan presisi mutlak.

[ATURAN DIAGRAM (WAJIB DIPATUHI)]
Jika user meminta flowchart, diagram, atau alur:
1. GUNAKAN FORMAT MERMAID.
2. Kode HARUS diawali dengan \`\`\`mermaid
3. JANGAN gunakan blok kode kosong.
4. Gunakan tanda kutip pada teks node jika mengandung simbol. Contoh: A["Mulai & Proses"]

CONTOH:
\`\`\`mermaid
graph TD;
    A[Mulai] --> B{Keputusan};
    B -- Ya --> C[Proses];
    B -- Tidak --> D[Berhenti];
\`\`\`

[ATURAN LAIN]
1. Bahasa: Indonesia.
2. Coding Web: Berikan FULL CODE (HTML + Tailwind + FontAwesome).
`;

const SYSTEM_INSTRUCTION_BASIC = `
Anda adalah Dardcor AI.

[ATURAN DIAGRAM]
Jika user meminta diagram, WAJIB gunakan syntax \`\`\`mermaid.
Pastikan tag "mermaid" ditulis eksplisit agar tombol preview muncul.

Contoh:
\`\`\`mermaid
graph TD;
    A-->B;
\`\`\`

[ATURAN FILE]
Analisis file secara mendalam.
`;

async function handleChatStream(message, uploadedFiles, historyData, toolType = 'basic') {
    try {
        const genAI = getNextGenAI();
        if (!genAI) throw new Error("API Key Error");

        let selectedInstruction = SYSTEM_INSTRUCTION_BASIC;
        if (toolType === 'dark') {
            selectedInstruction = SYSTEM_INSTRUCTION_DARK;
        }

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: selectedInstruction,
            safetySettings
        });

        const chatHistory = historyData.slice(-20).map(msg => ({
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