import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ ids: new Set<string>(), insertCalls: 0, updateCalls: 0, failRead: false }));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));

vi.mock("@/core/auth/session", async () => {
  const { NextResponse } = await import("next/server");
  return { getAuthenticatedUser: mocks.getUser, authenticationRequiredResponse: () => NextResponse.json({ error: "required" }, { status: 401 }) };
});
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ from: mocks.from })) }));

import { POST } from "./route";

const project = { id: "legacy-id", name: "Legacy", description: "", goal: "", createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z", status: "planning", kind: "general", studios: { branding: false, website: false, app: false, marketing: false, documents: false } };
const request = () => new Request("http://localhost/api/projects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects: [project] }) });

function builder(result: () => unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["eq", "in"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return chain;
}

describe("founder project import", () => {
  beforeEach(() => {
    state.ids.clear(); state.insertCalls = 0; state.updateCalls = 0; state.failRead = false;
    mocks.getUser.mockReset().mockResolvedValue({ id: "founder" });
    mocks.from.mockReset().mockImplementation(() => ({
      select: (_columns: string, options?: { head?: boolean }) => builder(() => state.failRead
        ? { data: null, error: { code: "read" } }
        : options?.head ? { count: state.ids.size, error: null } : { data: [...state.ids].map((id) => ({ id })), error: null }),
      insert: vi.fn(async (rows: Array<{ id: string }>) => { state.insertCalls += 1; rows.forEach((row) => state.ids.add(row.id)); return { error: null }; }),
      update: vi.fn(() => { state.updateCalls += 1; return builder(() => ({ error: null })); }),
    }));
  });

  it("imports a controlled fixture and retries without duplication", async () => {
    const first = await POST(request());
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ sourceCount: 1, matchedCount: 1, localDataRetained: true });
    const second = await POST(request());
    expect(second.status).toBe(200);
    expect(state.ids.size).toBe(1);
    expect(state.insertCalls).toBe(1);
    expect(state.updateCalls).toBe(1);
  });

  it("returns a controlled destination diagnostic", async () => {
    state.failRead = true;
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: "IMPORT_DESTINATION_READ_FAILED" });
  });
});
