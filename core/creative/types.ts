export const CREATIVE_COPY_DELIVERABLES = [
  "brand-foundation",
  "website-copy",
  "social-kit",
] as const;

export type CreativeCopyDeliverable =
  (typeof CREATIVE_COPY_DELIVERABLES)[number];

export const CREATIVE_IMAGE_INTENTS = [
  "logo-mark",
  "brand-texture",
  "website-hero",
  "editorial-photo",
  "product-shot",
  "social-visual",
] as const;

export type CreativeImageIntent =
  (typeof CREATIVE_IMAGE_INTENTS)[number];

export const CREATIVE_IMAGE_ASPECTS = [
  "square",
  "portrait",
  "landscape",
  "hero",
] as const;

export type CreativeImageAspect =
  (typeof CREATIVE_IMAGE_ASPECTS)[number];

export const CREATIVE_IMAGE_TIERS = [
  "draft",
  "premium",
  "ultra",
] as const;

export type CreativeImageTier =
  (typeof CREATIVE_IMAGE_TIERS)[number];

export type CreativeLocale = "es" | "en" | "pt" | "fr";

export interface CreativeBrandPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface CreativeBrandContext {
  name: string;
  slogan?: string;
  mission?: string;
  personality?: string[];
  palette?: CreativeBrandPalette;
  visualDirection?: string;
}

export interface CreativeCopyRequest {
  projectId: string;
  deliverable: CreativeCopyDeliverable;
  locale: CreativeLocale;
  brief: string;
  brand: CreativeBrandContext;
}

export interface BrandFoundationContent {
  positioning: string;
  brandPromise: string;
  audience: string;
  mission: string;
  values: string[];
  voice: {
    traits: string[];
    principles: string[];
    avoid: string[];
  };
  taglineOptions: string[];
}

export interface WebsiteCopyContent {
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  sections: Array<{
    id: string;
    title: string;
    body: string;
    cta: string;
  }>;
}

export interface SocialKitContent {
  bio: string;
  launchCaption: string;
  contentPillars: string[];
  postIdeas: Array<{
    title: string;
    hook: string;
    caption: string;
  }>;
}

export interface CreativeCopyContentByDeliverable {
  "brand-foundation": BrandFoundationContent;
  "website-copy": WebsiteCopyContent;
  "social-kit": SocialKitContent;
}

export type CreativeCopyContent =
  CreativeCopyContentByDeliverable[CreativeCopyDeliverable];

export interface CreativeCopyResult<
  Deliverable extends CreativeCopyDeliverable = CreativeCopyDeliverable,
> {
  deliverable: Deliverable;
  content: CreativeCopyContentByDeliverable[Deliverable];
  provider: "openai";
  model: string;
  createdAt: string;
}

export interface CreativeCopyApiResponse<
  Deliverable extends CreativeCopyDeliverable = CreativeCopyDeliverable,
> {
  requestId: string;
  result: CreativeCopyResult<Deliverable>;
}

export interface CreativeImageRequest {
  projectId: string;
  intent: CreativeImageIntent;
  aspect: CreativeImageAspect;
  tier: CreativeImageTier;
  brief: string;
  brand: CreativeBrandContext;
  /**
   * Identifies one user-initiated generation operation for duplicate
   * protection. It never becomes part of the provider prompt.
   */
  operationId?: string;
}

export type CreativeImageMimeType =
  | "image/png"
  | "image/webp"
  | "image/jpeg";

export type CreativeImageOutputFormat =
  | "png"
  | "webp"
  | "jpeg";

export interface CreativeImagePreset {
  size: string;
  width: number;
  height: number;
  quality: "low" | "medium" | "high";
  outputFormat: CreativeImageOutputFormat;
  background: "opaque";
  experimental: boolean;
}

export interface CreativeImageResult {
  data: ArrayBuffer;
  byteLength: number;
  mimeType: CreativeImageMimeType;
  width: number;
  height: number;
  experimental: boolean;
  provider: "openai";
  model: string;
  createdAt: string;
}

export interface CreativeImageResponseMetadata {
  requestId: string;
  assetId: string;
  width: number;
  height: number;
  experimental: boolean;
  mimeType: CreativeImageMimeType;
  model: string;
  createdAt: string;
}

export const CREATIVE_IMAGE_RESPONSE_HEADERS = {
  requestId: "X-Request-Id",
  assetId: "X-Vaeora-Asset-Id",
  width: "X-Vaeora-Image-Width",
  height: "X-Vaeora-Image-Height",
  experimental: "X-Vaeora-Image-Experimental",
  model: "X-Vaeora-Model",
  createdAt: "X-Vaeora-Created-At",
} as const;

export type CreativeValidationErrorCode =
  | "VAEORA_INVALID_REQUEST"
  | "VAEORA_UNSUPPORTED_PRESET";

export interface CreativeValidationIssue {
  code: CreativeValidationErrorCode;
  message: string;
}

export type CreativeValidationResult<Value> =
  | {
      success: true;
      data: Value;
    }
  | {
      success: false;
      error: CreativeValidationIssue;
    };

export type CreativeApiErrorCode =
  | "IAURA_ACCESS_REQUIRED"
  | "IAURA_ACCESS_NOT_CONFIGURED"
  | "VAEORA_INVALID_REQUEST"
  | "VAEORA_ORIGIN_REJECTED"
  | "VAEORA_UNSUPPORTED_MEDIA_TYPE"
  | "VAEORA_PAYLOAD_TOO_LARGE"
  | "VAEORA_UNSUPPORTED_PRESET"
  | "VAEORA_CONTENT_REJECTED"
  | "VAEORA_RATE_LIMITED"
  | "VAEORA_CREATIVE_NOT_CONFIGURED"
  | "VAEORA_EMPTY_RESULT"
  | "VAEORA_PROVIDER_TIMEOUT"
  | "VAEORA_REQUEST_CANCELLED"
  | "VAEORA_PROVIDER_ERROR";

export interface CreativeApiErrorResponse {
  error: string;
  code: CreativeApiErrorCode;
  requestId: string;
}
