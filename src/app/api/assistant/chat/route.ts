import { z } from "zod";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { streamAssistantReply, type AssistantEvent } from "@/lib/assistant/gemini";

export const runtime = "nodejs";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(12)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "Pesan terakhir harus dari pengguna.",
    }),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const { messages } = chatSchema.parse(await readJson(request));
    const events = streamAssistantReply(user, messages, request.signal);
    // Potongan pertama diambil sebelum stream dimulai agar error konfigurasi tetap berupa respons HTTP biasa.
    const first = await events.next();
    return streamResponse(events, first);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

type StreamLine = AssistantEvent | { type: "done" } | { type: "error"; error: string; code: string };

const encoder = new TextEncoder();

function encodeLine(line: StreamLine) {
  return encoder.encode(`${JSON.stringify(line)}\n`);
}

function toErrorLine(error: unknown): StreamLine {
  if (error instanceof ApiError) return { type: "error", error: error.message, code: error.code };
  console.error("Asisten AI gagal saat menjawab.", error);
  return { type: "error", error: "Asisten AI sedang tidak tersedia. Silakan coba lagi beberapa saat.", code: "AI_UNAVAILABLE" };
}

function streamResponse(events: AsyncGenerator<AssistantEvent>, first: IteratorResult<AssistantEvent>) {
  let prefetched: IteratorResult<AssistantEvent> | undefined = first;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = prefetched ?? (await events.next());
        prefetched = undefined;
        if (result.done) {
          controller.enqueue(encodeLine({ type: "done" }));
          controller.close();
          return;
        }
        controller.enqueue(encodeLine(result.value));
      } catch (error) {
        controller.enqueue(encodeLine(toErrorLine(error)));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
