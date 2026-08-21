export type IntelligenceScopeType = "global" | "project";
export type IntelligenceRecordType =
  | "direction"
  | "goal"
  | "priority"
  | "recurring_commitment";

interface IntelligenceRecordBase {
  id: string;
  userId: string;
  type: IntelligenceRecordType;
  scopeType: IntelligenceScopeType;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectionRecord extends IntelligenceRecordBase {
  type: "direction";
  content: string;
  status: "active" | "archived";
}

export interface GoalRecord extends IntelligenceRecordBase {
  type: "goal";
  title: string;
  status: "active" | "completed" | "archived";
  targetDate: string | null;
}

export interface PriorityRecord extends IntelligenceRecordBase {
  type: "priority";
  title: string | null;
  status: "active" | "archived";
  goalId: string | null;
  position: number;
}

export interface RecurringCommitmentRecord extends IntelligenceRecordBase {
  type: "recurring_commitment";
  title: string;
  status: "active" | "paused" | "archived";
  cadence: "daily" | "weekly" | "custom";
  cadenceDetail: string | null;
}

export type IntelligenceRecord =
  | DirectionRecord
  | GoalRecord
  | PriorityRecord
  | RecurringCommitmentRecord;

export type IntelligenceCreateInput =
  | Pick<DirectionRecord, "type" | "scopeType" | "projectId" | "content">
  | Pick<GoalRecord, "type" | "scopeType" | "projectId" | "title" | "targetDate">
  | Pick<PriorityRecord, "type" | "scopeType" | "projectId" | "title" | "goalId">
  | Pick<RecurringCommitmentRecord, "type" | "scopeType" | "projectId" | "title" | "cadence" | "cadenceDetail">;

export interface IntelligenceUpdateInput {
  title?: string;
  content?: string;
  status?: IntelligenceRecord["status"];
  targetDate?: string | null;
  goalId?: string | null;
  cadence?: RecurringCommitmentRecord["cadence"];
  cadenceDetail?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function nullableText(value: unknown, maxLength = 500): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return text(value, maxLength) ?? undefined;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validTargetDate(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

export function validScope(
  scopeType: unknown,
  projectId: unknown,
): scopeType is IntelligenceScopeType {
  return (
    (scopeType === "global" && projectId === null) ||
    (scopeType === "project" && Boolean(text(projectId, 200)))
  );
}

export function normalizeIntelligenceRecord(value: unknown): IntelligenceRecord | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 200);
  const userId = text(value.userId, 200);
  if (
    !id || !userId ||
    !validScope(value.scopeType, value.projectId) ||
    !validTimestamp(value.createdAt) ||
    !validTimestamp(value.updatedAt)
  ) return null;

  const base = {
    id,
    userId,
    scopeType: value.scopeType,
    projectId: value.projectId === null ? null : text(value.projectId, 200)!,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (value.type === "direction") {
    const content = text(value.content, 2000);
    if (!content || !["active", "archived"].includes(String(value.status))) return null;
    return { ...base, type: "direction", content, status: value.status as DirectionRecord["status"] };
  }

  if (value.type === "goal") {
    const title = text(value.title, 500);
    if (!title || !["active", "completed", "archived"].includes(String(value.status)) || !validTargetDate(value.targetDate)) return null;
    return { ...base, type: "goal", title, status: value.status as GoalRecord["status"], targetDate: value.targetDate };
  }

  if (value.type === "priority") {
    const title = nullableText(value.title, 500);
    const goalId = nullableText(value.goalId, 200);
    if (title === undefined || goalId === undefined || Boolean(title) === Boolean(goalId) || !["active", "archived"].includes(String(value.status)) || !Number.isInteger(value.position) || Number(value.position) < 1 || Number(value.position) > 3) return null;
    return { ...base, type: "priority", title, status: value.status as PriorityRecord["status"], goalId, position: Number(value.position) };
  }

  if (value.type === "recurring_commitment") {
    const title = text(value.title, 500);
    const cadenceDetail = nullableText(value.cadenceDetail, 500);
    if (!title || cadenceDetail === undefined || !["active", "paused", "archived"].includes(String(value.status)) || !["daily", "weekly", "custom"].includes(String(value.cadence)) || (value.cadence === "custom" && !cadenceDetail)) return null;
    return { ...base, type: "recurring_commitment", title, status: value.status as RecurringCommitmentRecord["status"], cadence: value.cadence as RecurringCommitmentRecord["cadence"], cadenceDetail };
  }

  return null;
}

export function isArchived(record: IntelligenceRecord): boolean {
  return record.status === "archived";
}

export function activeIntelligenceProjection(
  records: IntelligenceRecord[],
  activeProjectId: string | null,
): IntelligenceRecord[] {
  return records.filter((record) =>
    !isArchived(record) && (
      record.scopeType === "global" ||
      (activeProjectId !== null && record.projectId === activeProjectId)
    ),
  );
}

export function validatePriorityLimit(records: IntelligenceRecord[]): boolean {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.type !== "priority" || record.status !== "active") continue;
    const scope = record.scopeType === "global" ? "global" : `project:${record.projectId}`;
    const count = (counts.get(scope) ?? 0) + 1;
    if (count > 3) return false;
    counts.set(scope, count);
  }
  return true;
}
