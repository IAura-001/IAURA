import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuthenticatedProfile } from "./types";

export async function getAuthenticatedProfile(userId: string): Promise<AuthenticatedProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("id, first_name, last_name, display_name, onboarding_completed").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    displayName: data.display_name,
    onboardingCompleted: data.onboarding_completed,
  };
}
