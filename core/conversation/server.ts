import "server-only";

import type { ConversationRepositorySnapshot } from "./ConversationRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAuthenticatedConversationSnapshot(
  userId: string,
): Promise<ConversationRepositorySnapshot | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("conversation_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (
    typeof data.data !== "object" ||
    data.data === null ||
    Array.isArray(data.data)
  ) {
    throw new Error("Stored conversation state is invalid.");
  }

  return data.data as ConversationRepositorySnapshot;
}