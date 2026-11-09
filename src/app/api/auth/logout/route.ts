import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
