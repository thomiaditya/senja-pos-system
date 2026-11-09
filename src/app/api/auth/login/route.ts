import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import type { SessionUser, UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));
    const row = db.prepare(`
      SELECT id, name, username, role, password_hash
      FROM users
      WHERE username = ? AND active = 1
    `).get(input.username) as {
      id: string;
      name: string;
      username: string;
      role: UserRole;
      password_hash: string;
    } | undefined;
    const passwordMatches = row
      ? await bcrypt.compare(input.password, row.password_hash)
      : await bcrypt.compare(input.password, "$2a$11$abcdefghijklmnopqrstuu7e7SgR3DYtnL0sK7rM4syb1N0.4N4u");
    if (!row || !passwordMatches) {
      throw new ApiError(401, "Username atau password tidak sesuai.", "INVALID_CREDENTIALS");
    }

    const tokenVersion = (db.prepare("SELECT token_version FROM users WHERE id = ?")
      .get(row.id) as { token_version: number }).token_version;
    const user: SessionUser = { id: row.id, name: row.name, username: row.username, role: row.role };
    await createSession(user, tokenVersion);
    return NextResponse.json({ user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
