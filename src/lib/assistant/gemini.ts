import { ApiError } from "@/lib/api";
import { getAssistantFunctionDeclarations, runAssistantTool } from "@/lib/assistant/tools";
import type { SessionUser } from "@/lib/types";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type GeminiPart = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  [key: string]: unknown;
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_TOOL_ROUNDS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

const ROLE_LABELS: Record<SessionUser["role"], string> = {
  admin: "Admin (SPV)",
  cashier: "Kasir",
  barista: "Barista",
  kitchen: "Kitchen",
};

const UNAVAILABLE_MESSAGE = "Asisten AI sedang tidak tersedia. Silakan coba lagi beberapa saat.";

function buildSystemInstruction(user: SessionUser) {
  return [
    "Kamu adalah penasihat operasional restoran dan kedai kopi yang berpengalaman, untuk Kopi Senja. Kamu ahli di bidang operasional harian: alur shift, antrean pesanan, kecepatan layanan, manajemen meja, stok dan bahan baku, pengendalian biaya, pengelolaan kasir dan kas, serta pelatihan tim kasir, barista, kitchen, dan admin.",
    `Kamu sedang berbicara dengan ${user.name} yang login sebagai ${ROLE_LABELS[user.role]}.`,
    "Jawab dalam Bahasa Indonesia yang singkat, jelas, dan praktis. Utamakan langkah tindakan yang bisa langsung dijalankan tim hari ini.",
    "Untuk pertanyaan tentang kondisi toko (pesanan, meja, penjualan, menu, stok, shift, atau piutang), panggil tool yang tersedia dan dasarkan analisis pada hasilnya. Jangan menebak angka.",
    "Saat memberi saran, bedakan dengan jelas mana yang berasal dari data toko dan mana yang berupa praktik umum. Jika data tidak cukup untuk menilai, katakan itu dan sebutkan data apa yang dibutuhkan.",
    "Berikan saran yang sesuai dengan role pengguna. Untuk hal yang butuh keputusan admin atau SPV (harga, diskon besar, pembelian stok, pengeluaran, kasbon), arahkan ke admin.",
    "Kamu hanya dapat membaca data. Kamu tidak dapat mengubah pesanan, stok, pembayaran, atau pengaturan. Jika pengguna meminta perubahan, jelaskan cara melakukannya di aplikasi.",
    "Jika data yang diminta tidak tersedia untuk role pengguna, jelaskan dengan sopan dan sarankan menghubungi admin.",
    "Tulis harga dalam format Rupiah dengan pemisah ribuan titik, misalnya Rp50.000.",
    "Jika pengguna bertanya cara memakai aplikasi, jelaskan langkahnya secara singkat.",
  ].join("\n");
}

async function generateContent(apiKey: string, model: string, body: unknown): Promise<GeminiResponse> {
  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Permintaan ke Gemini gagal dikirim.", error);
    throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
  }

  if (response.status === 429) {
    throw new ApiError(429, "Asisten AI sedang sibuk. Coba lagi dalam beberapa saat.", "AI_RATE_LIMITED");
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Gemini mengembalikan status ${response.status}.`, detail.slice(0, 300));
    throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
  }
  return (await response.json()) as GeminiResponse;
}

export async function answerWithAssistant(user: SessionUser, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(
      503,
      "Fitur AI belum dikonfigurasi. Minta admin mengisi GEMINI_API_KEY.",
      "AI_NOT_CONFIGURED",
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const functionDeclarations = getAssistantFunctionDeclarations(user);
  const contents: GeminiContent[] = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await generateContent(apiKey, model, {
      systemInstruction: { parts: [{ text: buildSystemInstruction(user) }] },
      contents,
      ...(functionDeclarations.length > 0 ? { tools: [{ functionDeclarations }] } : {}),
    });

    const candidate = data.candidates?.[0];
    if (!candidate?.content) {
      if (data.promptFeedback?.blockReason) {
        return "Maaf, pertanyaan ini tidak dapat saya jawab. Coba tanyakan dengan kalimat lain.";
      }
      throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
    }

    const parts = candidate.content.parts ?? [];
    const functionCalls = parts.filter((part) => part.functionCall);
    if (functionCalls.length === 0) {
      const text = parts
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("")
        .trim();
      return text || "Maaf, saya belum bisa menjawab pertanyaan itu. Coba tanyakan dengan kalimat lain.";
    }

    // Kirim kembali konten model apa adanya agar thought signature tetap terbawa.
    contents.push(candidate.content);
    contents.push({
      role: "user",
      parts: functionCalls.map((part) => {
        const name = part.functionCall!.name;
        return { functionResponse: { name, response: runAssistantTool(user, name) } };
      }),
    });
  }

  return "Maaf, pertanyaan ini membutuhkan terlalu banyak langkah. Coba persempit pertanyaannya.";
}
