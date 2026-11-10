import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { addTabOrder, getOrderForUser, getTabDetail, requireRole } from "@/lib/pos-service";

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
    const orderId = addTabOrder(user, id, await readJson(request));
    return NextResponse.json(
      { tab: getTabDetail(user, id), order: getOrderForUser(user, orderId) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
