import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { deleteMapShape, requireRole, updateMapShape } from "@/lib/pos-service";

export const runtime = "nodejs";

async function parseShapeId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const shapeId = Number(id);
  if (!Number.isSafeInteger(shapeId) || shapeId <= 0) {
    throw new ApiError(400, "ID bentuk tidak valid.", "INVALID_MAP_SHAPE_ID");
  }
  return shapeId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    updateMapShape(user, await parseShapeId(params), await readJson(request));
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
    deleteMapShape(user, await parseShapeId(params));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
