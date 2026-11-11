import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getAppUpdateStatus } from "@/lib/app-update";
import { requireRole } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    const force = new URL(request.url).searchParams.get("force") === "1";
    const status = await getAppUpdateStatus({ force });
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
