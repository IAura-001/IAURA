import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const form = await request.formData(); const email = String(form.get("email") ?? "").trim().slice(0, 320);
  if (email.includes("@")) {
    const supabase = await createServerSupabaseClient(request);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${new URL(request.url).origin}/auth/reset` });
  }
  return NextResponse.redirect(new URL("/forgot-password?sent=1", request.url), 303);
}
