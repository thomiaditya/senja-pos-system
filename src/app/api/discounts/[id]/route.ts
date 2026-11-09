import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { deleteDiscount, requireRole, updateDiscount } from "@/lib/pos-service";

export const runtime = "nodejs";

async function resolveDiscountId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const discountId = Number(id);
  if (!Number.isSafeInteger(discountId) || discountId <= 0) {
    throw new ApiError(400, "ID diskon tidak valid.", "INVALID_DISCOUNT_ID");
  }
  return discountId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    updateDiscount(user, await resolveDiscountId(params), await readJson(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    deleteDiscount(user, await resolveDiscountId(params));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
