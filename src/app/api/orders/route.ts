import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { autoOpenDrawerAfterCashSale, createPaidOrder, getOrderForUser, requireRole } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin", "cashier"]);
    const id = createPaidOrder(user, await readJson(request));
    const order = getOrderForUser(user, id);
    const drawer = order.paymentMethod === "Cash" ? await autoOpenDrawerAfterCashSale(user) : null;
    return NextResponse.json({ order, drawer }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
