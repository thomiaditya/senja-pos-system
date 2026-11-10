import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { answerWithAssistant } from "@/lib/assistant/gemini";

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
    const reply = await answerWithAssistant(user, messages);
    return NextResponse.json({ reply });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
