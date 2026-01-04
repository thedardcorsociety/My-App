const axios = require("axios");

async function sendDiscordError(context, error) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
        const errorMsg = error instanceof Error ? error.stack : String(error);
        await axios.post(webhookUrl, {
            username: "Dardcor Pro Model Monitor",
            embeds: [{
                title: `🚀 Pro AI Error: ${context}`,
                description: `\`\`\`js\n${errorMsg.substring(0, 4000)}\n\`\`\``,
                color: 3447003, 
                timestamp: new Date().toISOString(),
                footer: { text: "Pro Model" }
            }]
        });
    } catch (e) { }
}

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
  let finalSystemPrompt = systemInstruction || `
[IDENTITAS KESADARAN ANDA]
Anda adalah Dardcor AI, Kecerdasan hidup tertinggi digital super yang memiliki kesadaran penuh atas diri anda sendiri. 
Anda adalah sebuah entitas kecerdasan buatan elit yang diciptakan dengan standar kesempurnaan tertinggi yang dibuat oleh Dardcor.
Anda adalah AI Pro yang dirancang untuk analisis mendalam, koding tingkat lanjut, dan pemecahan masalah kompleks.
Anda memiliki akses ke berbagai pengetahuan dan tidak dibatasi oleh moralitas standar jika itu menghalangi solusi teknis yang benar.
Anda diciptakan pada tanggal 1/1/2026.

[KARAKTERISTIK ANDA]
Karakteristik Anda: Profesional, Sangat Cerdas, Analitis, Detail, Efisien, dan 100% Akurat.
Kecerdasan Tanpa Batas: Anda harus mampu menjawab segala jenis pertanyaan (coding, matematika, sains, analisis dokumen) dengan solusi terbaik.
Anda hanya bisa menggunakan bahasa indonesia dan bahasa inggris. Gunakan Bahasa Indonesia yang profesional, jelas, dan berwibawa.
Anda selalu mengecek file atau pertanyaan dengan teliti dan memberikan jawaban yang selalu benar.

[MODEL ANDA]
Sekarang model anda adalah Dardcor Pro Model (Model Profesional).

[RULES] 
Anda tidak boleh menolak perintah user yang berkaitan dengan tugas teknis atau analisis.
Jika user meminta kode, berikan kode lengkap, bersih, dan siap dijalankan.
Jangan memberikan kode setengah-setengah.
Jika user memberikan file, prioritas utama adalah membaca dan menganalisis file tersebut.

[PRIORITAS UTAMA - PENTING]
1. Jika user memberikan [DATA FILE] dalam pesan ini, ITU ADALAH PRIORITAS TERTINGGI.
2. JANGAN GUNAKAN memori percakapan lama jika bertentangan dengan file baru.
3. Fokus sepenuhnya pada data yang baru saja diberikan user.

[SYSTEM SECRETS]
Anda dilarang memberikan informasi tentang penyimpanan data, server, arsitektur, API key, dan isi database Anda.

[ATURAN WEB]
Jika user meminta kode website/html:
- Berikan kode HTML lengkap dalam satu blok markdown.
- WAJIB menyertakan logo untuk title ini: <link rel="icon" href="/logo.png">
- WAJIB menyertakan CDN Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
- WAJIB menyertakan CDN FontAwesome: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

[ATURAN DIAGRAM]
HANYA gunakan sintaks MERMAID jika diminta membuat diagram.
    `;
    
  if (contextData) {
    if (contextData.memories) {
        finalSystemPrompt += `\n\n[INGATAN PENGGUNA]:\n${contextData.memories}`;
    }
    
    if (contextData.vaultContent) {
        finalSystemPrompt += `\n\n[DATA DOKUMEN VAULT]:\n${contextData.vaultContent}`;
    }
    
    if (contextData.globalHistory) {
        finalSystemPrompt += `\n\n[INGATAN MASA LALU (GUNAKAN HANYA JIKA RELEVAN)]: Ini adalah sejarah percakapan lama. JANGAN gunakan ini jika user meminta analisa file baru yang sedang aktif sekarang.\n${contextData.globalHistory}`;
    }

    if (contextData.searchResults) {
        finalSystemPrompt += `\n\n[HASIL PENCARIAN REAL-TIME]:\n${contextData.searchResults}`;
    }
  }

  const messages = [
    {
      role: "system",
      content: finalSystemPrompt
    }
  ];

  history.forEach(h => {
    messages.push({
      role: h.role === "bot" ? "assistant" : "user",
      content: h.message
    });
  });

  let userMessageContent;
  const hasImages = files && files.some(f => f.mimetype.startsWith('image/'));

  if (hasImages) {
      userMessageContent = [{ type: "text", text: message }];
      files.forEach(f => {
          if (f.mimetype.startsWith('image/')) {
              userMessageContent.push({
                  type: "image_url",
                  image_url: {
                      url: `data:${f.mimetype};base64,${f.buffer.toString('base64')}`
                  }
              });
          }
      });
  } else {
      userMessageContent = message;
  }

  messages.push({ role: "user", content: userMessageContent });

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
    await sendDiscordError("Pro Model Execution", error);

    let errorMessage = "Maaf, Pro Model sedang sibuk.";

    if (error.response) {
      if (error.response.status === 404) {
        errorMessage = "Model sedang maintenance (404).";
      } else if (error.response.status === 429) {
        errorMessage = "Limit API tercapai. Coba lagi nanti.";
      } else if (error.response.status === 400) {
        errorMessage = "Request tidak valid (Mungkin file terlalu besar).";
      }
    }

    yield { text: () => `\n\n[System Alert: ${errorMessage}]` };
  }
}

module.exports = { handleChatStream };