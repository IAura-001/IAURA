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
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return failure(request, nextPath);

  return completePostAuthClaim(request, nextPath);
}

function failure(request: Request, nextPath: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "credentials");
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, 303);
}
