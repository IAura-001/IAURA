import type {
  CreativeImagePreset,
  CreativeImageRequest,
} from "./types";

const STANDARD_SIZES: Record<
  CreativeImageRequest["aspect"],
  Pick<CreativeImagePreset, "size" | "width" | "height">
> = {
  square: {
    size: "1024x1024",
    width: 1024,
    height: 1024,
  },
  portrait: {
    size: "1024x1536",
    width: 1024,
    height: 1536,
  },
  landscape: {
    size: "1536x1024",
    width: 1536,
    height: 1024,
  },
  hero: {
    size: "1536x864",
    width: 1536,
    height: 864,
  },
};

export function resolveCreativeImagePreset(
  request: CreativeImageRequest,
): CreativeImagePreset {
  const isUltra = request.tier === "ultra";
  const standardSize = STANDARD_SIZES[request.aspect];

  return {
    ...(isUltra
      ? {
          size: "3840x2160",
          width: 3840,
          height: 2160,
        }
      : standardSize),
    quality: request.tier === "draft" ? "low" : "high",
    outputFormat: request.intent === "logo-mark" ? "png" : "webp",
    background: "opaque",
    experimental: isUltra,
  };
}

export function imageModelSupportsUltra(model: string): boolean {
  return model === "gpt-image-2" || model.startsWith("gpt-image-2-");
}
