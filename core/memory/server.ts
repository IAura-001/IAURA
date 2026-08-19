import "server-only";

import type { Memory } from "@/types/memory";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedMemoryState {
  exists: boolean;
  memory: Memory | null;
}

export async function getAuthenticatedMemoryState(
  userId: string,
): Promise<AuthenticatedMemoryState> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("memory_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    exists: Boolean(data),
    memory: data?.data
      ? (data.data as Memory)
      : null,
  };
}
