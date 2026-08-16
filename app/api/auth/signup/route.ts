import { NextResponse } from "next/server";

import { safeIauraNextPath } from "@/core/auth/redirects";
import { validateCredentials } from "@/core/auth/session";
import { completePostAuthClaim } from "@/core/auth/claimFlow";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const nextPath = safeIauraNextPath(String(form.get("next") ?? ""));
  const credentials = validateCredentials(form.get("email"), form.get("password"));

  if (!credentials) return failure(request, nextPath);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) return failure(request, nextPath);
  if (!data.session) return confirmationRequired(request, nextPath);

  return completePostAuthClaim(request, nextPath);
}

function confirmationRequired(request: Request, nextPath: string) {
  const url = new URL("/signup", request.url);
  url.searchParams.set("confirmation", "required");
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, 303);
}

function failure(request: Request, nextPath: string) {
  const url = new URL("/signup", request.url);
  url.searchParams.set("error", "signup");
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, 303);
}
