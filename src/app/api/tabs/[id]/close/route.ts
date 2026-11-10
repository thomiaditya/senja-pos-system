import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { autoOpenDrawerAfterCashSale, closeTab, getTabDetail, requireRole } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin", "cashier"]);
    const { id } = await params;
    const result = closeTab(user, id, await readJson(request));
    const drawer = result.paymentMethod === "Cash" && result.total > 0
      ? await autoOpenDrawerAfterCashSale(user)
      : null;
    return NextResponse.json({ tab: getTabDetail(user, id), result, drawer });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
