import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createDiningTable, requireRole } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    const id = createDiningTable(user, await readJson(request));
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
