import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getTabDetail, openTab, requireRole } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin", "cashier"]);
    const tabId = openTab(user, await readJson(request));
    return NextResponse.json({ tab: getTabDetail(user, tabId) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
