import { NextResponse } from "next/server";

import { safeIauraNextPath } from "@/core/auth/redirects";
import { validateCredentials } from "@/core/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const nextPath = safeIauraNextPath(String(form.get("next") ?? ""));
  const credentials = validateCredentials(form.get("email"), form.get("password"));

  if (!credentials) return failure(request, nextPath);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error || !data.session) return failure(request, nextPath);

  return NextResponse.redirect(new URL(nextPath, request.url), 303);
}

function failure(request: Request, nextPath: string) {
  const url = new URL("/signup", request.url);
  url.searchParams.set("error", "signup");
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, 303);
}
