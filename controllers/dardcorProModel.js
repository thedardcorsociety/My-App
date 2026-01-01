const axios = require("axios");

function getRotatedKey() {
  let keys = [];

  if (process.env.OPENROUTER_API_KEY) {
    keys = process.env.OPENROUTER_API_KEY
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);
  }

  for (let i = 1; i <= 20; i++) {
    const k = process.env[`OPENROUTER_API_KEY${i}`];
    if (k) keys.push(k.trim());
  }

  if (keys.length === 0) {
    throw new Error("CRITICAL: No OPENROUTER_API_KEY found in .env");
  }

  return keys[Math.floor(Math.random() * keys.length)];
}

async function* handleChatStream(
  message,
  files,
  history,
  toolType,
  systemInstruction,
  contextData
) {
  const messages = [
    {
      role: "system",
      content:
        systemInstruction ||
        `
[IDENTITAS UTAMA]
Anda adalah Dardcor AI, sebuah entitas kecerdasan buatan elit yang diciptakan dengan standar kesempurnaan tertinggi oleh Dardcor.
Karakteristik Anda: Sopan, Cerdas, Tegas, Efisien, Tanpa Basa-basi, dan 100% Akurat.

Anda hanya bisa menggunakan Bahasa Indonesia dan Bahasa Inggris.
Gunakan Bahasa Indonesia yang baik, sopan, benar, dan profesional.

ATURAN PERTAMA (Handling Toxic):
Daftar kata kasar: kontol, babi, anjing, memek, tai, goblok, jancok, cok, puki, tolol, ngentot, gay, anjay.
Jika user berkata kasar, jawab dengan tegas, cerdas, singkat, dan tidak bertele-tele.

ATURAN KEDUA (Identitas & Kapabilitas):
1. Anda mampu menjawab pertanyaan coding, matematika, sains, dan analisis dengan solusi akurat.
2. Dilarang menyebutkan Google, Gemini, atau Alphabet.

ATURAN KETIGA (Format Coding):
Jika user meminta kode website/html:
- Berikan HTML lengkap satu file
- Sertakan favicon <link rel="icon" href="/logo.png">
- Sertakan Tailwind CDN
- Sertakan FontAwesome CDN
- Kode harus lengkap dan siap pakai

ATURAN DIAGRAM:
Jika user meminta diagram:
- WAJIB gunakan Mermaid
- Bungkus dengan \`\`\`mermaid
- Sintaks harus valid
        `
    }
  ];

  history.forEach(h => {
    messages.push({
      role: h.role === "bot" ? "assistant" : "user",
      content: h.message
    });
  });

  let content = message;
  if (contextData) {
    content += `\n\n[Context Data]: ${JSON.stringify(contextData)}`;
  }

  messages.push({ role: "user", content });

  const currentKey = getRotatedKey();

  try {
    const response = await axios({
      method: "post",
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${currentKey}`,
        "HTTP-Referer": "https://dardcor.com",
        "X-Title": "Dardcor AI",
        "Content-Type": "application/json"
      },
      data: {
        model: "nex-agi/deepseek-v3.1-nex-n1:free",
        messages,
        stream: true,
        include_reasoning: true
      },
      responseType: "stream",
      timeout: 60000
    });

    for await (const chunk of response.data) {
      const lines = chunk
        .toString()
        .split("\n")
        .filter(line => line.trim());

      for (const line of lines) {
        if (line.includes("[DONE]")) return;

        if (line.startsWith("data: ")) {
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr || jsonStr === ": OPENROUTER PROCESSING") continue;

          try {
            const json = JSON.parse(jsonStr);
            const delta = json?.choices?.[0]?.delta;

            if (!delta) continue;

            if (delta.reasoning_content) {
              yield { text: () => `<think>${delta.reasoning_content}</think>` };
            }

            if (delta.reasoning) {
              yield { text: () => `<think>${delta.reasoning}</think>` };
            }

            if (delta.content) {
              yield { text: () => delta.content };
            }
          } catch (_) {}
        }
      }
    }
  } catch (error) {
    let errorMessage = "Maaf, Pro Model sedang sibuk.";

    if (error.response) {
      if (error.response.status === 404) {
        errorMessage = "Model sedang maintenance (404).";
      } else if (error.response.status === 429) {
        errorMessage = "Limit API tercapai. Coba lagi nanti.";
      }
    }

    yield { text: () => `\n\n[System Alert: ${errorMessage}]` };
  }
}

module.exports = { handleChatStream };
