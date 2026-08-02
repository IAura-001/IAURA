import type {
  CreativeCopyDeliverable,
  CreativeImageIntent,
  CreativeLocale,
} from "@/core/creative/types";

export type CreativeStudioArea =
  | "direction"
  | "image"
  | "website"
  | "library";

export interface CreativeStudioRequest {
  id: number;
  area: CreativeStudioArea | "launch";
}

export type CreativeDeliverable = CreativeCopyDeliverable;

export type CreativeAssetIntent = CreativeImageIntent;

export type CreativeAssetStatus =
  | "draft"
  | "selected"
  | "approved"
  | "archived";

export interface CreativeBrandBrief {
  brandName: string;
  audience: string;
  offer: string;
  personality: string;
  visualDirection: string;
  constraints: string;
  locale: CreativeLocale;
}

export interface CreativeBriefRevision {
  id: string;
  brief: CreativeBrandBrief;
  createdAt: string;
}

export interface CreativeGenerationRecord {
  deliverable: CreativeDeliverable;
  data: unknown;
  model: string;
  brandRevisionId: string;
  generatedAt: string;
}

export type CreativeOutputHistory = Partial<
  Record<CreativeDeliverable, CreativeGenerationRecord[]>
>;

export interface CreativeAssetMetadata {
  id: string;
  projectId: string;
  kind: CreativeAssetIntent;
  title: string;
  status: CreativeAssetStatus;
  blobKey: string;
  prompt: string;
  altText: string;
  width: number;
  height: number;
  mimeType: "image/png" | "image/webp" | "image/jpeg";
  byteSize: number;
  model: string;
  quality: "low" | "medium" | "high";
  tier?: "draft" | "premium" | "ultra";
  experimental?: boolean;
  requestId?: string;
  brandRevisionId: string;
  parentAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeLegacyImport {
  brandingContent: Record<string, string>;
  launchAssetIds: string[];
  sourceKeys: string[];
  importedAt: string;
}

export interface CreativeStudioMemory {
  schemaVersion: 1;
  brief: CreativeBrandBrief;
  brandRevisionId: string;
  briefHistory: CreativeBriefRevision[];
  outputs: Partial<
    Record<CreativeDeliverable, CreativeGenerationRecord>
  >;
  outputHistory: CreativeOutputHistory;
  assets: CreativeAssetMetadata[];
  legacyImport?: CreativeLegacyImport;
  updatedAt: string;
}

export interface StoredCreativeAsset {
  metadata: CreativeAssetMetadata;
  blob: Blob;
  thumbnail?: Blob;
}

export interface StoredCreativeAssetSummary {
  metadata: CreativeAssetMetadata;
  thumbnail?: Blob;
}
