import type {
  IntelligenceCreateInput,
  IntelligenceRecord,
  IntelligenceUpdateInput,
  IntelligenceScopeType,
} from "./domain";
import type { IAuraProject } from "@/types/project";
import type { IntelligenceActionProposal } from "./actionTypes";
import {
  buildIntelligenceContextProjection,
  type IntelligenceContextProjection,
} from "./contextProjection";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof failure?.error === "string" ? failure.error : `Intelligence request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export class AuthenticatedIntelligenceRepository {
  async loadAll(): Promise<IntelligenceRecord[]> {
    const body = await request<{ records: IntelligenceRecord[] }>("/api/intelligence");
    return body.records;
  }

  async loadProjection(activeProjectId: string | null): Promise<IntelligenceRecord[]> {
    const query = activeProjectId
      ? `?projectId=${encodeURIComponent(activeProjectId)}`
      : "?scope=global";
    const body = await request<{ records: IntelligenceRecord[] }>(`/api/intelligence${query}`);
    return body.records;
  }

  async loadContextProjection(
    activeProject: IAuraProject | null,
  ): Promise<IntelligenceContextProjection> {
    const records = await this.loadProjection(activeProject?.id ?? null);
    return buildIntelligenceContextProjection(records, activeProject);
  }

  async create(input: IntelligenceCreateInput, executionId?: string, operation?: IntelligenceActionProposal["operation"], expectedActiveProjectId?: string | null): Promise<IntelligenceRecord> {
    const body = await request<{ record: IntelligenceRecord }>("/api/intelligence", {
      method: "POST",
      body: JSON.stringify({
        record: input,
        executionId,
        operation,
        expectedActiveProjectId: expectedActiveProjectId === undefined
          ? input.projectId
          : expectedActiveProjectId,
      }),
    });
    return body.record;
  }

  async update(id: string, updates: IntelligenceUpdateInput, expectedUpdatedAt?: string, authority?: { scopeType: IntelligenceScopeType; projectId: string | null; expectedActiveProjectId: string | null }): Promise<IntelligenceRecord> {
    const body = await request<{ record: IntelligenceRecord }>(
      `/api/intelligence/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ updates, expectedUpdatedAt, authority }) },
    );
    return body.record;
  }

  async archive(id: string): Promise<IntelligenceRecord> {
    const body = await request<{ record: IntelligenceRecord }>(
      `/api/intelligence/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return body.record;
  }

  async reorderPriorities(
    scopeType: IntelligenceScopeType,
    projectId: string | null,
    orderedPriorityIds: string[],
    expectedPriorities?: Array<{ recordId: string; position: number; updatedAt: string }>,
    expectedActiveProjectId?: string | null,
  ): Promise<IntelligenceRecord[]> {
    const body = await request<{ records: IntelligenceRecord[] }>(
      "/api/intelligence/priorities/reorder",
      { method: "POST", body: JSON.stringify({ scopeType, projectId, orderedPriorityIds, expectedPriorities, expectedActiveProjectId }) },
    );
    return body.records;
  }
}

export const authenticatedIntelligenceRepository =
  new AuthenticatedIntelligenceRepository();
