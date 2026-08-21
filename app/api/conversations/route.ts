import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";
import type { ConversationRepositorySnapshot } from "@/core/conversation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const headers = {
  "Cache-Control": "no-store",
};

function isConversationSnapshot(
  value: unknown,
): value is ConversationRepositorySnapshot {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const snapshot = value as Record<string, unknown>;

  return (
    typeof snapshot.schemaVersion === "number" &&
    typeof snapshot.revision === "number" &&
    typeof snapshot.updatedAt === "string" &&
    typeof snapshot.writerId === "string" &&
    typeof snapshot.migrationCompletedAt === "string" &&
    (
      snapshot.activeConversationId === null ||
      typeof snapshot.activeConversationId === "string"
    ) &&
    Array.isArray(snapshot.conversations)
  );
}

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("conversation_state")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: "Unable to load conversation state.",
      },
      {
        status: 500,
        headers,
      },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        snapshot: null,
      },
      {
        headers,
      },
    );
  }

  if (!isConversationSnapshot(data.data)) {
    return NextResponse.json(
      {
        error: "Stored conversation state is invalid.",
      },
      {
        status: 500,
        headers,
      },
    );
  }

  return NextResponse.json(
    {
      snapshot: data.data,
    },
    {
      headers,
    },
  );
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const body = await request
    .json()
    .catch(() => null) as {
      snapshot?: unknown;
      expectedRevision?: unknown;
    } | null;

  if (
    !body ||
    !isConversationSnapshot(body.snapshot) ||
    typeof body.expectedRevision !== "number" ||
    !Number.isInteger(body.expectedRevision) ||
    body.expectedRevision < 0 ||
    body.snapshot.revision !== body.expectedRevision + 1
  ) {
    return NextResponse.json(
      {
        error: "Invalid conversation state.",
      },
      {
        status: 400,
        headers,
      },
    );
  }

  const supabase = await createServerSupabaseClient();

  const table = supabase.from("conversation_state");
  let data: { data: ConversationRepositorySnapshot } | null = null;
  let error: { code?: string; message?: string; details?: string; hint?: string } | null = null;

  if (body.expectedRevision === 0) {
    const existing = await table.select("data").eq("user_id", user.id).maybeSingle();
    if (!existing.error && !existing.data) {
      const inserted = await table.insert({ user_id: user.id, data: body.snapshot })
        .select("data").single();
      data = inserted.data as typeof data;
      error = inserted.error;
    } else if (existing.error) {
      error = existing.error;
    }
  }

  if (!data && !error) {
    const updated = await table.update({ data: body.snapshot })
      .eq("user_id", user.id)
      .eq("data->>revision", String(body.expectedRevision))
      .select("data")
      .maybeSingle();
    data = updated.data as typeof data;
    error = updated.error;
  }

  if (!error && !data) {
    return NextResponse.json(
      { error: "Conversation state changed in another session.", code: "IAURA_STATE_STALE_WRITE" },
      { status: 409, headers },
    );
  }

  if (error) {
    console.error("Conversation state persistence failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: user.id,
    });
    return NextResponse.json(
      {
        error: "Unable to persist conversation state.",
        code: error.code,
      },
      {
        status: 500,
        headers,
      },
    );
  }

  return NextResponse.json(
    {
      snapshot: data!.data,
    },
    {
      headers,
    },
  );
}
