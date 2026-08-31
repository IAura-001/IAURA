import { describe, expect, it } from "vitest";
import { creativeAssetPath, portableAssetMetadata, validateCreativeAssetUpload } from "../contracts";
import type { CreativeAssetMetadata } from "@/types/creative-studio";

const metadata: CreativeAssetMetadata = {
  id: "asset_1", projectId: "project_1", kind: "website-hero", title: "Hero", status: "draft",
  blobKey: "asset_1", prompt: "private content", altText: "Light", width: 100, height: 100,
  mimeType: "image/png", byteSize: 4, model: "provider-model", quality: "low",
  requestId: "provider-request", brandRevisionId: "revision_1",
  createdAt: "2026-08-30T00:00:00Z", updatedAt: "2026-08-30T00:00:00Z",
};

describe("cloud asset entitlement inputs", () => {
  it("validates authoritative metadata bytes without reading unrelated binaries", () => {
    const original = new File(["1234"], "original.png", { type: "image/png" });
    const thumbnail = new File(["12"], "thumbnail.webp", { type: "image/webp" });
    expect(validateCreativeAssetUpload(metadata, original, thumbnail)).toBeNull();
    expect(validateCreativeAssetUpload(metadata, new File(["12345"], "bad.png", { type: "image/png" })))
      .toBe("Unsupported asset size.");
  });
  it("rejects cross-scope and traversal path identifiers", () => {
    expect(creativeAssetPath("user_1", "project_1", "asset_1", "original"))
      .toBe("user_1/project_1/asset_1/original");
    expect(() => creativeAssetPath("user_1", "../project", "asset_1", "original")).toThrow();
  });
  it("keeps content and provider accounting out of portable metadata", () => {
    const portable = portableAssetMetadata(metadata);
    expect(portable).not.toHaveProperty("prompt"); expect(portable).not.toHaveProperty("requestId");
    expect(portable).not.toHaveProperty("model");
  });
});
