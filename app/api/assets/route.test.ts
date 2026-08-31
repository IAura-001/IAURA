import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), createServer: vi.fn(), createAdmin: vi.fn(),
}));
vi.mock("@/core/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/core/auth/session")>("@/core/auth/session");
  return { ...actual, getAuthenticatedUser: mocks.getUser };
});
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServer }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: mocks.createAdmin }));

import { POST } from "./route";

function authenticatedClient() {
  const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn()
    .mockResolvedValue({ data: { id: "project-a" }, error: null }) };
  projectQuery.select.mockReturnValue(projectQuery); projectQuery.eq.mockReturnValue(projectQuery);
  const assetQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn()
    .mockResolvedValue({ data: null, error: null }) };
  assetQuery.select.mockReturnValue(assetQuery); assetQuery.eq.mockReturnValue(assetQuery);
  const rpc = vi.fn((name: string) => Promise.resolve(name === "reserve_asset_storage"
    ? { data: "reservation-a", error: null } : { data: true, error: null }));
  return { from: vi.fn((table: string) => table === "projects" ? projectQuery : assetQuery), rpc };
}

describe("POST /api/assets authoritative storage boundary", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.createServer.mockReset(); mocks.createAdmin.mockReset();
  });

  it("uploads with server-only authority only after reserving quota, then finalizes accounting", async () => {
    const client = authenticatedClient();
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upload, remove });
    mocks.createServer.mockResolvedValue(client);
    mocks.createAdmin.mockReturnValue({ storage: { from } });
    const metadata = {
      id: "asset-a", projectId: "project-a", kind: "website-hero", title: "Hero", status: "draft",
      blobKey: "asset-a", prompt: "prompt", altText: "Hero", width: 1, height: 1,
      mimeType: "image/png", byteSize: 4, model: "model", quality: "low", requestId: "request-a",
      brandRevisionId: "revision-a", createdAt: "2026-08-30T00:00:00Z", updatedAt: "2026-08-30T00:00:00Z",
    };
    const form = new FormData(); form.set("metadata", JSON.stringify(metadata));
    form.set("original", new File(["1234"], "original.png", { type: "image/png" }));
    const request = new Request("http://localhost/api/assets", { method: "POST" });
    vi.spyOn(request, "formData").mockResolvedValue(form);
    const response = await POST(request);
    expect({ status: response.status, body: await response.clone().json() })
      .toEqual({ status: 201, body: { stored: true } });
    expect(client.rpc).toHaveBeenNthCalledWith(1, "reserve_asset_storage", expect.objectContaining({
      requested_project_id: "project-a", requested_asset_id: "asset-a", requested_bytes: 4,
    }));
    expect(upload).toHaveBeenCalledWith("user-a/project-a/asset-a/original", expect.any(File),
      expect.objectContaining({ upsert: false }));
    expect(client.rpc).toHaveBeenNthCalledWith(2, "finalize_asset_storage", expect.objectContaining({
      reservation_id: "reservation-a", requested_byte_size: 4,
    }));
  });
});
