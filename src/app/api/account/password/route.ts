import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { createSession, getCurrentUser } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const tokenVersion = await changeOwnPassword(user, await readJson(request));
    // Password change bumps token_version, so re-issue this device's session to keep it signed in.
    await createSession(user, tokenVersion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
