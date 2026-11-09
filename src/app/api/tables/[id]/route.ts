import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { deleteDiningTable, requireRole, updateDiningTable } from "@/lib/pos-service";

export const runtime = "nodejs";

async function parseTableId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const tableId = Number(id);
  if (!Number.isSafeInteger(tableId) || tableId <= 0) {
    throw new ApiError(400, "ID meja tidak valid.", "INVALID_TABLE_ID");
  }
  return tableId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    requireRole(user, ["admin"]);
    updateDiningTable(user, await parseTableId(params), await readJson(request));
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
    deleteDiningTable(user, await parseTableId(params));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
