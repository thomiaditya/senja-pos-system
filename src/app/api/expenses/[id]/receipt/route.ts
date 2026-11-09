import { apiErrorResponse, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getExpenseReceipt } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const { id } = await params;
    const { buffer, mime } = await getExpenseReceipt(user, id);
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=86400" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
