import type { CreativeAssetMetadata, StoredCreativeAsset, StoredCreativeAssetSummary } from "@/types/creative-studio";

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(body?.error ?? `Cloud asset request failed (${response.status}).`);
}

export const cloudCreativeAssets = {
  async put(metadata: CreativeAssetMetadata, blob: Blob, thumbnail?: Blob): Promise<void> {
    const form = new FormData(); form.set("metadata", JSON.stringify(metadata));
    form.set("original", new File([blob], "original", { type: blob.type }));
    if (thumbnail) form.set("thumbnail", new File([thumbnail], "thumbnail", { type: thumbnail.type }));
    const response = await fetch("/api/assets", { method: "POST", body: form });
    if (!response.ok) throw await responseError(response);
  },
  async list(projectId: string): Promise<StoredCreativeAssetSummary[]> {
    const response = await fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    if (!response.ok) throw await responseError(response);
    const body = await response.json() as { assets: Array<{ metadata: CreativeAssetMetadata; thumbnailUrl?: string }> };
    return Promise.all(body.assets.map(async ({ metadata, thumbnailUrl }) => ({ metadata,
      ...(thumbnailUrl ? { thumbnail: await fetch(thumbnailUrl).then((result) => result.blob()) } : {}) })));
  },
  async get(assetId: string): Promise<StoredCreativeAsset | null> {
    const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw await responseError(response);
    const body = await response.json() as { metadata: CreativeAssetMetadata; originalUrl: string; thumbnailUrl?: string };
    const blob = await fetch(body.originalUrl).then((result) => {
      if (!result.ok) throw new Error("Cloud original is unavailable."); return result.blob();
    });
    return { metadata: body.metadata, blob };
  },
  async delete(assetId: string): Promise<void> {
    const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw await responseError(response);
  },
  async updateMetadata(metadata: CreativeAssetMetadata): Promise<void> {
    const response = await fetch(`/api/assets/${encodeURIComponent(metadata.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metadata }),
    });
    if (!response.ok) throw await responseError(response);
  },
};
