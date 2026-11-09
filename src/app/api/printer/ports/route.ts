import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { listPrinterPorts } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const ports = await listPrinterPorts(user);
    return NextResponse.json({ ports });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
