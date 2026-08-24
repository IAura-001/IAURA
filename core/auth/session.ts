import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { AUTH_REQUIRED_CODE } from "./redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function validateCredentials(emailValue: unknown, passwordValue: unknown) {
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const validEmail = email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPassword = password.length >= 8 && password.length <= 128;

  return validEmail && validPassword ? { email, password } : null;
}

export async function getAuthenticatedUser(request?: Request): Promise<User | null> {
  try {
    const supabase = await createServerSupabaseClient(request);
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export function authenticationRequiredResponse() {
  return NextResponse.json(
    { error: "IAURA authentication required.", code: AUTH_REQUIRED_CODE },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
