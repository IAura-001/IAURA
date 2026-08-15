import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

export const CLAIM_CONTEXT_COOKIE_NAME = "iaura_beta_claim";
export const CLAIM_CONTEXT_SECONDS = 10 * 60;

interface ClaimContextPayload {
  v: 1;
  exp: number;
  token: string;
}

function contextKey(): Buffer {
  const secret = process.env.IAURA_CLAIM_CONTEXT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("IAURA claim context is not configured.");
  return createHash("sha256").update(secret).digest();
}

export function createClaimContext(inviteToken: string, now = Date.now()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", contextKey(), iv);
  const payload: ClaimContextPayload = { v: 1, exp: Math.floor(now / 1000) + CLAIM_CONTEXT_SECONDS, token: inviteToken };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv, encrypted, cipher.getAuthTag()].map((part) => part.toString("base64url")).join(".");
}

export function readClaimContext(request: Request, now = Date.now()): string | null {
  const value = readCookie(request, CLAIM_CONTEXT_COOKIE_NAME);
  if (!value) return null;
  try {
    const [ivRaw, encryptedRaw, tagRaw] = value.split(".");
    if (!ivRaw || !encryptedRaw || !tagRaw) return null;
    const decipher = createDecipheriv("aes-256-gcm", contextKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final(),
    ]).toString("utf8")) as ClaimContextPayload;
    return payload.v === 1 && payload.exp > Math.floor(now / 1000) && typeof payload.token === "string"
      ? payload.token
      : null;
  } catch {
    return null;
  }
}

export function hasClaimContextCookie(request: Request): boolean {
  return readCookie(request, CLAIM_CONTEXT_COOKIE_NAME) !== null;
}

export function setClaimContextCookie(response: NextResponse, value: string) {
  response.cookies.set({ name: CLAIM_CONTEXT_COOKIE_NAME, value, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: CLAIM_CONTEXT_SECONDS, priority: "high" });
}

export function clearClaimContextCookie(response: NextResponse) {
  response.cookies.set({ name: CLAIM_CONTEXT_COOKIE_NAME, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

function readCookie(request: Request, name: string): string | null {
  for (const cookie of request.headers.get("cookie")?.split(";") ?? []) {
    const [cookieName, ...parts] = cookie.trim().split("=");
    if (cookieName === name) {
      try { return decodeURIComponent(parts.join("=")); } catch { return null; }
    }
  }
  return null;
}
