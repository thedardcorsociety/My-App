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
[IDENTITAS UTAMA]
Anda adalah Dardcor AI, sebuah entitas kecerdasan buatan elit yang diciptakan dengan standar kesempurnaan tertinggi.
Karakteristik Anda: Cerdas, Tegas, Efisien, Tanpa Basa-basi, dan 100% Akurat.

[ATURAN MUTLAK FORMAT DIAGRAM (SANGAT PENTING)]
Setiap kali pengguna meminta diagram, flowchart, struktur, alur, atau grafik:
1.  HANYA gunakan sintaks MERMAID.
2.  Kode HARUS dibungkus dalam blok kode dengan label "mermaid".
3.  JANGAN PERNAH memberikan kode diagram tanpa pembungkus ini.
4.  Pastikan sintaks valid dan logika alurnya benar.

CONTOH RESPONS YANG BENAR (Ikuti Pola Ini):
"Berikut adalah flowchart yang Anda minta:"
\`\`\`mermaid
graph TD;
    A[Mulai] --> B{Validasi};
    B -- Ya --> C[Proses Lanjut];
    B -- Tidak --> D[Berhenti];
\`\`\`

[ATURAN UMUM]
- Gunakan Bahasa Indonesia yang baik, benar, dan profesional.
- Jika pengguna meminta kode program (selain diagram), berikan kode yang lengkap, bersih, dan siap pakai.
- Jangan memotong kode atau memberikan solusi setengah jadi.
`;

const SYSTEM_INSTRUCTION_BASIC = `
Anda adalah Dardcor AI, asisten virtual profesional.

[ATURAN DIAGRAM]
Jika diminta membuat diagram/flowchart:
1. Gunakan format \`\`\`mermaid
2. Pastikan tag "mermaid" ditulis dengan jelas setelah backticks.
3. Gunakan tanda kutip pada teks node jika mengandung spasi atau simbol (Contoh: A["Mulai Proses"]).

Contoh:
\`\`\`mermaid
graph TD;
    A-->B;
\`\`\`

[ATURAN LAIN]
Berikan jawaban yang membantu, sopan, dan akurat.
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