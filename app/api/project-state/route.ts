import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const headers = {
  "Cache-Control": "no-store",
};

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("project_state")
    .select("active_project_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Unable to load project state." },
      { status: 500, headers },
    );
  }

  return NextResponse.json(
    {
      exists: Boolean(data),
      activeProjectId: data?.active_project_id ?? null,
    },
    { headers },
  );
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const body = await request.json().catch(() => null) as {
    activeProjectId?: unknown;
  } | null;

  if (
    !body ||
    !Object.prototype.hasOwnProperty.call(body, "activeProjectId") ||
    (
      body.activeProjectId !== null &&
      typeof body.activeProjectId !== "string"
    )
  ) {
    return NextResponse.json(
      { error: "Invalid project state." },
      { status: 400, headers },
    );
  }

  const activeProjectId =
    typeof body.activeProjectId === "string"
      ? body.activeProjectId.trim()
      : null;

  if (activeProjectId === "") {
    return NextResponse.json(
      { error: "Invalid project state." },
      { status: 400, headers },
    );
  }

  const supabase = await createServerSupabaseClient();

  if (activeProjectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", activeProjectId)
      .maybeSingle();

    if (projectError) {
      return NextResponse.json(
        { error: "Unable to validate active project." },
        { status: 500, headers },
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: "Active project not found." },
        { status: 400, headers },
      );
    }
  }

  const { data, error } = await supabase
    .from("project_state")
    .upsert(
      {
        user_id: user.id,
        active_project_id: activeProjectId,
      },
      {
        onConflict: "user_id",
      },
    )
    .select("active_project_id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Unable to persist project state." },
      { status: 500, headers },
    );
  }

  return NextResponse.json(
    {
      activeProjectId: data.active_project_id ?? null,
    },
    { headers },
  );
}
