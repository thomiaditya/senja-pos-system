import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(400, "Isi permintaan bukan JSON yang valid.", "INVALID_JSON");
    }
    throw error;
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: "Data yang dikirim belum valid.", code: "INVALID_INPUT", details: error.issues },
      { status: 400 },
    );
  }

  console.error("Permintaan POS gagal diproses.", error);
  return Response.json(
    { error: "Terjadi kesalahan pada server. Silakan coba lagi.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
