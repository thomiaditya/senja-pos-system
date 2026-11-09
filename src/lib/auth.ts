import "server-only";

import { cookies } from "next/headers";
import { errors, SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import type { SessionUser, UserRole } from "@/lib/types";

const SESSION_COOKIE = "kopi-senja-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET belum tersedia. Jalankan `pnpm db:setup` terlebih dahulu.");
  }
  return new TextEncoder().encode(secret);
}

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "cashier" || value === "barista" || value === "kitchen";
}

export async function createSession(user: SessionUser, tokenVersion: number) {
  const token = await new SignJWT({ role: user.role, ver: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] }));
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }

  if (typeof payload.sub !== "string" || !isUserRole(payload.role) || typeof payload.ver !== "number") {
    return null;
  }

  const user = db.prepare(`
    SELECT id, name, username, role, token_version
    FROM users
    WHERE id = ? AND active = 1
  `).get(payload.sub) as
    | { id: string; name: string; username: string; role: UserRole; token_version: number }
    | undefined;

  if (!user || user.token_version !== payload.ver || !isUserRole(user.role)) return null;
  return { id: user.id, name: user.name, username: user.username, role: user.role };
}
