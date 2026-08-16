import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as { firstName?: unknown; lastName?: unknown; displayName?: unknown } | null;
  const firstName = clean(body?.firstName, 80);
  const lastName = clean(body?.lastName, 100);
  const displayName = clean(body?.displayName, 120) || firstName;
  if (!firstName || !displayName) return NextResponse.json({ error: "First and display names are required." }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").update({ first_name: firstName, last_name: lastName || null, display_name: displayName, onboarding_completed: true }).eq("id", user.id).select("id, first_name, last_name, display_name, onboarding_completed").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to save profile." }, { status: 500, headers });
  if (!data) return NextResponse.json({ error: "Profile not found." }, { status: 404, headers });
  return NextResponse.json({ profile: { id: data.id, firstName: data.first_name, lastName: data.last_name, displayName: data.display_name, onboardingCompleted: data.onboarding_completed } }, { headers });
}
