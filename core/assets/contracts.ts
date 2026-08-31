import type { CreativeAssetMetadata } from "@/types/creative-studio";

export const CREATIVE_ASSET_BUCKET = "creative-assets";
export const MAX_CREATIVE_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_CREATIVE_THUMBNAIL_BYTES = 2 * 1024 * 1024;
export const CREATIVE_ASSET_MIME_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);

export function creativeAssetPath(userId: string, projectId: string, assetId: string,
  variant: "original" | "thumbnail"): string {
  const ids = [userId, projectId, assetId];
  if (ids.some((id) => !/^[a-zA-Z0-9_-]{1,200}$/.test(id))) throw new Error("Invalid asset path identifier.");
  return `${userId}/${projectId}/${assetId}/${variant}`;
}

export function validateCreativeAssetUpload(metadata: CreativeAssetMetadata, file: File,
  thumbnail?: File | null): string | null {
  if (!metadata.id || !metadata.projectId || metadata.blobKey !== metadata.id) return "Invalid asset identity.";
  if (!CREATIVE_ASSET_MIME_TYPES.has(file.type) || file.type !== metadata.mimeType) return "Unsupported asset type.";
  if (file.size < 1 || file.size > MAX_CREATIVE_ASSET_BYTES || file.size !== metadata.byteSize) return "Unsupported asset size.";
  if (thumbnail && (!CREATIVE_ASSET_MIME_TYPES.has(thumbnail.type) || thumbnail.size > MAX_CREATIVE_THUMBNAIL_BYTES)) {
    return "Unsupported thumbnail.";
  }
  return null;
}

export function portableAssetMetadata(metadata: CreativeAssetMetadata) {
  const portable: Partial<CreativeAssetMetadata> = { ...metadata };
  delete portable.prompt;
  delete portable.requestId;
  delete portable.model;
  return portable;
}
