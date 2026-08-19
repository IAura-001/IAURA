import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const headers = {
  "Cache-Control": "no-store",
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("memory_state")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Unable to load memory state." },
      { status: 500, headers },
    );
  }

  return NextResponse.json(
    {
      exists: Boolean(data),
      memory: data?.data ?? null,
    },
    { headers },
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
      memory?: unknown;
    } | null;

  if (
    !body ||
    !Object.prototype.hasOwnProperty.call(body, "memory") ||
    !isRecord(body.memory)
  ) {
    return NextResponse.json(
      { error: "Invalid memory state." },
      { status: 400, headers },
    );
  }

  const serialized = JSON.stringify(body.memory);

  if (serialized.length > 131072) {
    return NextResponse.json(
      { error: "Memory state is too large." },
      { status: 413, headers },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("memory_state")
    .upsert(
      {
        user_id: user.id,
        data: body.memory,
      },
      {
        onConflict: "user_id",
      },
    )
    .select("data")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Unable to persist memory state." },
      { status: 500, headers },
    );
  }

  return NextResponse.json(
    {
      memory: data.data,
    },
    { headers },
  );
}
