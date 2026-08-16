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
