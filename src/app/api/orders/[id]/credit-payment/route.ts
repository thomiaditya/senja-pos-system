import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getOrderForUser, settleCreditPayment } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const { id } = await params;
    settleCreditPayment(user, id, await readJson(request));
    return NextResponse.json({ order: getOrderForUser(user, id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
