import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const form = await request.formData(); const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 128) return NextResponse.redirect(new URL("/reset-password?error=invalid", request.url), 303);
  const supabase = await createServerSupabaseClient(request); const { data: session } = await supabase.auth.getUser();
  if (!session.user) return NextResponse.redirect(new URL("/reset-password?error=invalid", request.url), 303);
  const { error } = await supabase.auth.updateUser({ password });
  return NextResponse.redirect(new URL(error ? "/reset-password?error=invalid" : "/login?password=updated", request.url), 303);
}
