import { apiErrorResponse, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { readStoreLogo } from "@/lib/pos-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Silakan login kembali.", "UNAUTHENTICATED");
    const { buffer, mime } = await readStoreLogo();
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=86400" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
