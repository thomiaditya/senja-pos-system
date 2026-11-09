import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, updateProduct } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new ApiError(400, "ID menu tidak valid.", "INVALID_PRODUCT_ID");
    }
    updateProduct(user, productId, await readJson(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
