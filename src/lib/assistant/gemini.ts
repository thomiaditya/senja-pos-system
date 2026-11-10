import { ApiError } from "@/lib/api";
import { getAssistantFunctionDeclarations, runAssistantTool } from "@/lib/assistant/tools";
import { guidedTasks, type GuidedTask } from "@/lib/guided-tasks";
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

const SUGGEST_TASK_TOOL = "suggest_guided_task";
const UNAVAILABLE_MESSAGE = "Asisten AI sedang tidak tersedia. Silakan coba lagi beberapa saat.";
const BLOCKED_MESSAGE = "Maaf, pertanyaan ini tidak dapat saya jawab. Coba tanyakan dengan kalimat lain.";
const EMPTY_MESSAGE = "Maaf, saya belum bisa menjawab pertanyaan itu. Coba tanyakan dengan kalimat lain.";
const TOO_MANY_STEPS_MESSAGE = "Maaf, pertanyaan ini membutuhkan terlalu banyak langkah. Coba persempit pertanyaannya.";

export type AssistantEvent = { type: "delta"; text: string } | { type: "task"; taskId: string };

function guidedTasksFor(user: SessionUser) {
  return guidedTasks.filter((task) => task.roles.includes(user.role));
}

function suggestTaskDeclaration(tasks: GuidedTask[]) {
  return {
    name: SUGGEST_TASK_TOOL,
    description:
      "Tampilkan tombol untuk memulai panduan langkah demi langkah di aplikasi. Panggil saat pengguna ingin dipandu atau bertanya apa yang harus dikerjakan.",
    parameters: {
      type: "OBJECT",
      properties: {
        taskId: {
          type: "STRING",
          description: "ID panduan dari daftar yang tersedia.",
          enum: tasks.map((task) => task.id),
        },
      },
      required: ["taskId"],
    },
  };
}

function buildSystemInstruction(user: SessionUser) {
  const tasks = guidedTasksFor(user);
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
    "Jika pengguna meminta dipandu, bertanya harus mulai dari mana, atau bertanya apa yang harus dikerjakan sekarang: (1) periksa kondisi toko yang relevan dengan tool, (2) pilih satu panduan yang paling tepat dari daftar di bawah, (3) WAJIB panggil suggest_guided_task dengan taskId tersebut sebelum menulis jawaban akhir. Sebutkan dalam teks singkat mengapa panduan itu yang paling tepat.",
    "Jangan pernah menyebut tombol atau panduan 'di bawah' jika kamu belum memanggil suggest_guided_task.",
    "Panduan yang tersedia untuk role ini:",
    ...tasks.map((task) => `- ${task.id}: ${task.title}. ${task.summary}`),
  ].join("\n");
}

async function* streamGenerateContent(
  apiKey: string,
  model: string,
  body: unknown,
  callerSignal?: AbortSignal,
): AsyncGenerator<GeminiResponse> {
  const controller = new AbortController();
  const abortUpstream = () => controller.abort();
  callerSignal?.addEventListener("abort", abortUpstream);
  // Batas waktu hanya untuk memulai respons; isi stream boleh berjalan lebih lama.
  const connectTimer = setTimeout(abortUpstream, REQUEST_TIMEOUT_MS);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  try {
    let response: Response;
    try {
      response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      console.error("Permintaan ke Gemini gagal dikirim.", error);
      throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
    } finally {
      clearTimeout(connectTimer);
    }

    if (response.status === 429) {
      throw new ApiError(429, "Asisten AI sedang sibuk. Coba lagi dalam beberapa saat.", "AI_RATE_LIMITED");
    }
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      console.error(`Gemini mengembalikan status ${response.status}.`, detail.slice(0, 300));
      throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (line.startsWith("data:")) yield JSON.parse(line.slice(5)) as GeminiResponse;
      }
    }
    const rest = (buffer + decoder.decode()).trim();
    if (rest.startsWith("data:")) yield JSON.parse(rest.slice(5)) as GeminiResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Gagal membaca respons stream dari Gemini.", error);
    throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
  } finally {
    callerSignal?.removeEventListener("abort", abortUpstream);
    clearTimeout(connectTimer);
    void reader?.cancel().catch(() => {});
  }
}

export async function* streamAssistantReply(
  user: SessionUser,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<AssistantEvent> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(
      503,
      "Fitur AI belum dikonfigurasi. Minta admin mengisi GEMINI_API_KEY.",
      "AI_NOT_CONFIGURED",
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const tasks = guidedTasksFor(user);
  const functionDeclarations = [
    ...getAssistantFunctionDeclarations(user),
    ...(tasks.length > 0 ? [suggestTaskDeclaration(tasks)] : []),
  ];
  const contents: GeminiContent[] = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  let suggestedTask = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const parts: GeminiPart[] = [];
    let blocked = false;
    let emitted = false;

    const stream = streamGenerateContent(
      apiKey,
      model,
      {
        systemInstruction: { parts: [{ text: buildSystemInstruction(user) }] },
        contents,
        ...(functionDeclarations.length > 0 ? { tools: [{ functionDeclarations }] } : {}),
      },
      signal,
    );
    for await (const chunk of stream) {
      if (chunk.promptFeedback?.blockReason) blocked = true;
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        // Semua part disimpan apa adanya agar thought signature ikut terkirim pada putaran berikutnya.
        parts.push(part);
        if (!part.thought && part.text) {
          emitted = true;
          yield { type: "delta", text: part.text };
        }
      }
    }

    const calls = parts.flatMap((part) => (part.functionCall ? [part.functionCall] : []));
    if (calls.length === 0) {
      if (!emitted && !suggestedTask) {
        if (blocked) yield { type: "delta", text: BLOCKED_MESSAGE };
        else if (parts.length === 0) throw new ApiError(502, UNAVAILABLE_MESSAGE, "AI_UNAVAILABLE");
        else yield { type: "delta", text: EMPTY_MESSAGE };
      }
      return;
    }

    contents.push({ role: "model", parts });
    const responses: { name: string; response: Record<string, unknown> }[] = [];
    for (const call of calls) {
      if (call.name !== SUGGEST_TASK_TOOL) {
        responses.push({ name: call.name, response: runAssistantTool(user, call.name) });
        continue;
      }
      const taskId = String(call.args?.taskId ?? "");
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task) {
        responses.push({ name: call.name, response: { error: "Panduan tidak tersedia untuk role akun ini." } });
        continue;
      }
      suggestedTask = true;
      yield { type: "task", taskId: task.id };
      responses.push({ name: call.name, response: { result: { ditampilkan: true } } });
    }
    contents.push({
      role: "user",
      parts: responses.map((response) => ({ functionResponse: response })),
    });
  }

  yield { type: "delta", text: TOO_MANY_STEPS_MESSAGE };
}
