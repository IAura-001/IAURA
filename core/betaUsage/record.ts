import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

interface RecordEventInput {
  type: string;
  projectId?: string | null;
  eventKey?: string | null;
  sessionId?: string | null;
  source?: string | null;
  metadata?: Record<string, string | boolean | number>;
}

export async function recordProductEvent(
  supabase: SupabaseClient,
  input: RecordEventInput,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("record_product_funnel_event", {
      p_event_type: input.type,
      p_project_id: input.projectId ?? null,
      p_event_key: input.eventKey ?? null,
      p_session_id: input.sessionId ?? null,
      p_source: input.source ?? null,
      p_schema_version: 1,
      p_metadata: input.metadata ?? {},
    });
    if (!error) return data === true;
    if (process.env.NODE_ENV === "development") {
      console.debug("Product funnel event skipped", { type: input.type, code: error.code });
    }
    return false;
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.debug("Product funnel event unavailable", { type: input.type });
    }
    return false;
  }
}
