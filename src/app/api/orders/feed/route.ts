import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getOrdersSignature } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Sesi login sudah berakhir.", "UNAUTHENTICATED");
    return NextResponse.json({ signature: getOrdersSignature(user) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
