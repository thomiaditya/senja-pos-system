import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getTabDetail } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const { id } = await params;
    return NextResponse.json({ tab: getTabDetail(user, id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
