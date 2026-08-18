import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeProject } from "./ProjectRepository";
import type { IAuraProject } from "./types";

export async function listAuthenticatedProjects(userId: string): Promise<IAuraProject[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("projects").select("data").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeProject(row.data)).filter((project): project is IAuraProject => Boolean(project));
}


export interface AuthenticatedProjectState {
  exists: boolean;
  activeProjectId: string | null;
}

export async function getAuthenticatedProjectState(
  userId: string,
): Promise<AuthenticatedProjectState> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("project_state")
    .select("active_project_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    exists: Boolean(data),
    activeProjectId: data?.active_project_id ?? null,
  };
}
