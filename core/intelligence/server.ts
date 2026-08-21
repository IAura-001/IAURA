import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  IntelligenceCreateInput,
  IntelligenceRecord,
  IntelligenceScopeType,
  IntelligenceUpdateInput,
} from "./domain";
import { normalizeIntelligenceRecord, validScope } from "./domain";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface IntelligenceRow {
  id: string;
  user_id: string;
  record_type: string;
  scope_type: string;
  project_id: string | null;
  title: string | null;
  content: string | null;
  status: string;
  target_date: string | null;
  goal_id: string | null;
  position: number | null;
  cadence: string | null;
  cadence_detail: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS = "id,user_id,record_type,scope_type,project_id,title,content,status,target_date,goal_id,position,cadence,cadence_detail,created_at,updated_at";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= max ? result : null;
}

function optional(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return clean(value, max) ?? undefined;
}

function rowToRecord(row: IntelligenceRow): IntelligenceRecord {
  const common = {
    id: row.id,
    userId: row.user_id,
    type: row.record_type,
    scopeType: row.scope_type,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    status: row.status,
    targetDate: row.target_date,
    goalId: row.goal_id,
    position: row.position,
    cadence: row.cadence,
    cadenceDetail: row.cadence_detail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const record = normalizeIntelligenceRecord(common);
  if (!record) throw new Error("IAURA_INTELLIGENCE_INVALID_PERSISTED_RECORD");
  return record;
}

async function requireOwnedProject(
  client: SupabaseClient,
  userId: string,
  scopeType: IntelligenceScopeType,
  projectId: string | null,
): Promise<void> {
  if (!validScope(scopeType, projectId)) throw new Error("IAURA_INTELLIGENCE_INVALID_SCOPE");
  if (scopeType === "global") return;
  const { data, error } = await client
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("id", projectId!)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("IAURA_INTELLIGENCE_PROJECT_NOT_OWNED");
}

async function validateGoalReference(
  client: SupabaseClient,
  userId: string,
  goalId: string | null,
  scopeType: IntelligenceScopeType,
  projectId: string | null,
): Promise<void> {
  if (!goalId) return;
  const { data, error } = await client
    .from("intelligence_records")
    .select("id,scope_type,project_id,record_type,status")
    .eq("user_id", userId)
    .eq("id", goalId)
    .maybeSingle();
  if (error) throw error;
  if (
    !data || data.record_type !== "goal" || data.status === "archived" ||
    data.scope_type !== scopeType || data.project_id !== projectId
  ) throw new Error("IAURA_INTELLIGENCE_INVALID_GOAL_REFERENCE");
}

export async function listIntelligenceRecords(userId: string): Promise<IntelligenceRecord[]> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("intelligence_records")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => rowToRecord(row as IntelligenceRow));
}

export async function loadIntelligenceProjection(
  userId: string,
  activeProjectId: string | null,
): Promise<IntelligenceRecord[]> {
  const client = await createServerSupabaseClient();
  if (activeProjectId) await requireOwnedProject(client, userId, "project", activeProjectId);
  const globalQuery = client
    .from("intelligence_records")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "archived")
    .eq("scope_type", "global");
  const [globalResult, projectResult] = await Promise.all([
    globalQuery,
    activeProjectId
      ? client.from("intelligence_records").select(SELECT_COLUMNS)
          .eq("user_id", userId).neq("status", "archived")
          .eq("scope_type", "project").eq("project_id", activeProjectId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (globalResult.error) throw globalResult.error;
  if (projectResult.error) throw projectResult.error;
  return [...(globalResult.data ?? []), ...(projectResult.data ?? [])]
    .map((row) => rowToRecord(row as IntelligenceRow))
    .sort((left, right) => {
      if (left.type !== right.type) return left.type.localeCompare(right.type);
      if (left.type === "priority" && right.type === "priority") return left.position - right.position;
      return left.createdAt.localeCompare(right.createdAt);
    });
}

export async function createIntelligenceRecord(
  userId: string,
  input: IntelligenceCreateInput,
): Promise<IntelligenceRecord> {
  const client = await createServerSupabaseClient();
  await requireOwnedProject(client, userId, input.scopeType, input.projectId);

  const base = {
    id: crypto.randomUUID(), user_id: userId, record_type: input.type,
    scope_type: input.scopeType, project_id: input.projectId,
  };
  let values: Record<string, unknown>;

  if (input.type === "direction") {
    const content = clean(input.content, 2000);
    if (!content) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values = { ...base, content, status: "active" };
  } else if (input.type === "goal") {
    const title = clean(input.title, 500);
    const targetDate = optional(input.targetDate, 10);
    if (!title || targetDate === undefined || (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate))) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values = { ...base, title, target_date: targetDate, status: "active" };
  } else if (input.type === "priority") {
    const title = optional(input.title, 500);
    const goalId = optional(input.goalId, 200);
    if (title === undefined || goalId === undefined || Boolean(title) === Boolean(goalId)) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    await validateGoalReference(client, userId, goalId, input.scopeType, input.projectId);
    let positionsQuery = client
      .from("intelligence_records")
      .select("position")
      .eq("user_id", userId).eq("record_type", "priority").eq("status", "active")
      .eq("scope_type", input.scopeType);
    positionsQuery = input.projectId === null
      ? positionsQuery.is("project_id", null)
      : positionsQuery.eq("project_id", input.projectId);
    const { data: positions, error: positionsError } = await positionsQuery;
    if (positionsError) throw positionsError;
    const occupied = new Set((positions ?? []).map((item) => item.position));
    const position = [1, 2, 3].find((candidate) => !occupied.has(candidate));
    if (!position) throw new Error("IAURA_INTELLIGENCE_PRIORITY_LIMIT");
    values = { ...base, title, goal_id: goalId, position, status: "active" };
  } else {
    const title = clean(input.title, 500);
    const cadenceDetail = optional(input.cadenceDetail, 500);
    if (!title || !["daily", "weekly", "custom"].includes(input.cadence) || cadenceDetail === undefined || (input.cadence === "custom" && !cadenceDetail)) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values = { ...base, title, cadence: input.cadence, cadence_detail: cadenceDetail, status: "active" };
  }

  const { data, error } = await client.from("intelligence_records").insert(values).select(SELECT_COLUMNS).single();
  if (error) throw error;
  return rowToRecord(data as IntelligenceRow);
}

export async function updateIntelligenceRecord(
  userId: string,
  id: string,
  updates: IntelligenceUpdateInput,
): Promise<IntelligenceRecord> {
  const client = await createServerSupabaseClient();
  const { data: existing, error: readError } = await client
    .from("intelligence_records").select(SELECT_COLUMNS)
    .eq("user_id", userId).eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new Error("IAURA_INTELLIGENCE_NOT_FOUND");
  const current = rowToRecord(existing as IntelligenceRow);
  const values: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    if (current.type === "direction") throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    if (current.type === "priority" && current.goalId !== null) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    const title = clean(updates.title, 500); if (!title) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT"); values.title = title;
  }
  if (updates.content !== undefined) {
    if (current.type !== "direction") throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    const content = clean(updates.content, 2000); if (!content) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT"); values.content = content;
  }
  if (updates.status !== undefined) {
    const allowed = current.type === "goal" ? ["active", "completed", "archived"]
      : current.type === "recurring_commitment" ? ["active", "paused", "archived"]
      : ["active", "archived"];
    if (!allowed.includes(updates.status)) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values.status = updates.status;
  }
  if (updates.targetDate !== undefined) {
    if (current.type !== "goal" || (updates.targetDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(updates.targetDate))) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values.target_date = updates.targetDate;
  }
  if (updates.goalId !== undefined) {
    if (current.type !== "priority" || current.title !== null || updates.goalId === null) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    await validateGoalReference(client, userId, updates.goalId, current.scopeType, current.projectId); values.goal_id = updates.goalId;
  }
  if (updates.cadence !== undefined) {
    if (current.type !== "recurring_commitment" || !["daily", "weekly", "custom"].includes(updates.cadence)) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    if (updates.cadence === "custom" && !(updates.cadenceDetail ?? current.cadenceDetail)) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values.cadence = updates.cadence;
  }
  if (updates.cadenceDetail !== undefined) {
    if (current.type !== "recurring_commitment" || (updates.cadenceDetail !== null && !clean(updates.cadenceDetail, 500))) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    if ((updates.cadence ?? current.cadence) === "custom" && updates.cadenceDetail === null) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");
    values.cadence_detail = updates.cadenceDetail?.trim() ?? null;
  }
  if (Object.keys(values).length === 0) throw new Error("IAURA_INTELLIGENCE_INVALID_INPUT");

  const { data, error } = await client.from("intelligence_records").update(values)
    .eq("user_id", userId).eq("id", id).select(SELECT_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("IAURA_INTELLIGENCE_NOT_FOUND");
  return rowToRecord(data as IntelligenceRow);
}

export async function archiveIntelligenceRecord(userId: string, id: string): Promise<IntelligenceRecord> {
  return updateIntelligenceRecord(userId, id, { status: "archived" });
}

export async function reorderIntelligencePriorities(
  userId: string,
  scopeType: IntelligenceScopeType,
  projectId: string | null,
  orderedPriorityIds: string[],
): Promise<IntelligenceRecord[]> {
  if (!validScope(scopeType, projectId) || orderedPriorityIds.length > 3 || new Set(orderedPriorityIds).size !== orderedPriorityIds.length) throw new Error("IAURA_INTELLIGENCE_INVALID_PRIORITY_ORDER");
  const client = await createServerSupabaseClient();
  await requireOwnedProject(client, userId, scopeType, projectId);
  const { data, error } = await client.rpc("reorder_intelligence_priorities", {
    ordered_ids: orderedPriorityIds,
    requested_scope_type: scopeType,
    requested_project_id: projectId,
  });
  if (error) throw error;
  return (data ?? []).map((row: IntelligenceRow) => rowToRecord(row));
}
