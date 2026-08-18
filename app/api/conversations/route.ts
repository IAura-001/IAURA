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
    } | null;

  if (!body || !isConversationSnapshot(body.snapshot)) {
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

  const { data, error } = await supabase
    .from("conversation_state")
    .upsert(
      {
        user_id: user.id,
        data: body.snapshot,
      },
      {
        onConflict: "user_id",
      },
    )
    .select("data")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "Unable to persist conversation state.",
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