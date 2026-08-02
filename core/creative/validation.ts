import {
  CREATIVE_COPY_DELIVERABLES,
  CREATIVE_IMAGE_ASPECTS,
  CREATIVE_IMAGE_INTENTS,
  CREATIVE_IMAGE_TIERS,
  type BrandFoundationContent,
  type CreativeBrandContext,
  type CreativeBrandPalette,
  type CreativeCopyContentByDeliverable,
  type CreativeCopyDeliverable,
  type CreativeCopyRequest,
  CREATIVE_IMAGE_RESPONSE_HEADERS,
  type CreativeImageMimeType,
  type CreativeImageRequest,
  type CreativeImageResponseMetadata,
  type CreativeValidationErrorCode,
  type CreativeValidationResult,
  type SocialKitContent,
  type WebsiteCopyContent,
} from "./types";

export const MAX_CREATIVE_JSON_BYTES = 32 * 1024;
export const MAX_CREATIVE_COPY_BRIEF_LENGTH = 4_000;
export const MAX_CREATIVE_IMAGE_BRIEF_LENGTH = 3_000;

const PROJECT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const SECTION_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);

  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      " ",
    )
    .trim();
}

function readText(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): string | null {
  if (typeof value !== "string") return null;

  const normalized = normalizeText(value);

  if (
    normalized.length < minimumLength ||
    normalized.length > maximumLength
  ) {
    return null;
  }

  return normalized;
}

function readOptionalText(
  value: unknown,
  maximumLength: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;

  const normalized = normalizeText(value);

  if (!normalized) return undefined;
  if (normalized.length > maximumLength) return null;

  return normalized;
}

function readTextArray(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
  maximumItemLength: number,
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    return null;
  }

  const normalized = value.map((item) =>
    readText(item, 1, maximumItemLength),
  );

  if (normalized.some((item) => item === null)) return null;

  return normalized as string[];
}

function invalid<Value>(
  message: string,
  code: CreativeValidationErrorCode = "VAEORA_INVALID_REQUEST",
): CreativeValidationResult<Value> {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function parsePalette(
  value: unknown,
): CreativeBrandPalette | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "primary",
      "secondary",
      "accent",
      "background",
      "text",
    ])
  ) {
    return null;
  }

  const entries = [
    "primary",
    "secondary",
    "accent",
    "background",
    "text",
  ] as const;
  const palette = {} as CreativeBrandPalette;

  for (const key of entries) {
    if (typeof value[key] !== "string") return null;

    const color = value[key].trim().toUpperCase();

    if (!HEX_COLOR_PATTERN.test(color)) return null;
    palette[key] = color;
  }

  return palette;
}

function parseBrandContext(
  value: unknown,
): CreativeBrandContext | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "name",
      "slogan",
      "mission",
      "personality",
      "palette",
      "visualDirection",
    ])
  ) {
    return null;
  }

  const name = readText(value.name, 1, 80);
  const slogan = readOptionalText(value.slogan, 180);
  const mission = readOptionalText(value.mission, 1_500);
  const visualDirection = readOptionalText(
    value.visualDirection,
    1_500,
  );

  if (
    !name ||
    slogan === null ||
    mission === null ||
    visualDirection === null
  ) {
    return null;
  }

  let personality: string[] | undefined;

  if (value.personality !== undefined) {
    personality = readTextArray(value.personality, 1, 5, 40) ?? undefined;

    if (!personality) return null;
    personality = [...new Set(personality)];
  }

  let palette: CreativeBrandPalette | undefined;

  if (value.palette !== undefined) {
    palette = parsePalette(value.palette) ?? undefined;

    if (!palette) return null;
  }

  return {
    name,
    ...(slogan ? { slogan } : {}),
    ...(mission ? { mission } : {}),
    ...(personality ? { personality } : {}),
    ...(palette ? { palette } : {}),
    ...(visualDirection ? { visualDirection } : {}),
  };
}

function isOneOf<Value extends string>(
  value: unknown,
  options: readonly Value[],
): value is Value {
  return (
    typeof value === "string" &&
    (options as readonly string[]).includes(value)
  );
}

export function validateCreativeCopyRequest(
  value: unknown,
): CreativeValidationResult<CreativeCopyRequest> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "projectId",
      "deliverable",
      "locale",
      "brief",
      "brand",
    ])
  ) {
    return invalid("The creative copy request is invalid.");
  }

  const projectId = readText(value.projectId, 1, 80);
  const brief = readText(
    value.brief,
    1,
    MAX_CREATIVE_COPY_BRIEF_LENGTH,
  );
  const brand = parseBrandContext(value.brand);

  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return invalid("A valid project ID is required.");
  }

  if (!isOneOf(value.deliverable, CREATIVE_COPY_DELIVERABLES)) {
    return invalid("The requested copy deliverable is not supported.");
  }

  if (!isOneOf(value.locale, ["es", "en", "pt", "fr"] as const)) {
    return invalid("The creative locale must be es, en, pt or fr.");
  }

  if (!brief) {
    return invalid("A creative brief between 1 and 4000 characters is required.");
  }

  if (!brand) {
    return invalid("The brand context is invalid.");
  }

  return {
    success: true,
    data: {
      projectId,
      deliverable: value.deliverable,
      locale: value.locale,
      brief,
      brand,
    },
  };
}

export function validateCreativeImageRequest(
  value: unknown,
): CreativeValidationResult<CreativeImageRequest> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "projectId",
      "intent",
      "aspect",
      "tier",
      "brief",
      "brand",
      "operationId",
    ])
  ) {
    return invalid("The creative image request is invalid.");
  }

  const projectId = readText(value.projectId, 1, 80);
  const brief = readText(
    value.brief,
    1,
    MAX_CREATIVE_IMAGE_BRIEF_LENGTH,
  );
  const brand = parseBrandContext(value.brand);
  const operationId = readOptionalText(value.operationId, 100);

  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return invalid("A valid project ID is required.");
  }

  if (!isOneOf(value.intent, CREATIVE_IMAGE_INTENTS)) {
    return invalid("The requested image intent is not supported.");
  }

  if (!isOneOf(value.aspect, CREATIVE_IMAGE_ASPECTS)) {
    return invalid("The requested image aspect is not supported.");
  }

  if (!isOneOf(value.tier, CREATIVE_IMAGE_TIERS)) {
    return invalid("The requested image tier is not supported.");
  }

  if (!brief) {
    return invalid("An image brief between 1 and 3000 characters is required.");
  }

  if (!brand) {
    return invalid("The brand context is invalid.");
  }

  if (
    operationId === null ||
    (operationId !== undefined && !OPERATION_ID_PATTERN.test(operationId))
  ) {
    return invalid("The creative operation ID is invalid.");
  }

  if (value.intent === "logo-mark" && value.aspect !== "square") {
    return invalid(
      "Logo marks require the square aspect preset.",
      "VAEORA_UNSUPPORTED_PRESET",
    );
  }

  if (
    value.tier === "ultra" &&
    value.aspect !== "landscape" &&
    value.aspect !== "hero"
  ) {
    return invalid(
      "Ultra generation is available only for landscape and hero assets.",
      "VAEORA_UNSUPPORTED_PRESET",
    );
  }

  return {
    success: true,
    data: {
      projectId,
      intent: value.intent,
      aspect: value.aspect,
      tier: value.tier,
      brief,
      brand,
      ...(operationId ? { operationId } : {}),
    },
  };
}

export function readCreativeImageResponseMetadata(
  response: Response,
): CreativeValidationResult<CreativeImageResponseMetadata> {
  const requestId = response.headers.get(
    CREATIVE_IMAGE_RESPONSE_HEADERS.requestId,
  );
  const assetId = response.headers.get(
    CREATIVE_IMAGE_RESPONSE_HEADERS.assetId,
  );
  const width = Number(
    response.headers.get(CREATIVE_IMAGE_RESPONSE_HEADERS.width),
  );
  const height = Number(
    response.headers.get(CREATIVE_IMAGE_RESPONSE_HEADERS.height),
  );
  const experimental = response.headers.get(
    CREATIVE_IMAGE_RESPONSE_HEADERS.experimental,
  );
  const model = response.headers.get(
    CREATIVE_IMAGE_RESPONSE_HEADERS.model,
  );
  const createdAt = response.headers.get(
    CREATIVE_IMAGE_RESPONSE_HEADERS.createdAt,
  );
  const mimeType = response.headers
    .get("content-type")
    ?.split(";", 1)[0] as CreativeImageMimeType | undefined;

  if (
    !requestId ||
    requestId.length > 100 ||
    !assetId ||
    !/^asset_[A-Za-z0-9-]{1,80}$/.test(assetId) ||
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    !Number.isSafeInteger(height) ||
    height <= 0 ||
    (experimental !== "true" && experimental !== "false") ||
    !model ||
    model.length > 100 ||
    !createdAt ||
    !Number.isFinite(Date.parse(createdAt)) ||
    (mimeType !== "image/png" &&
      mimeType !== "image/webp" &&
      mimeType !== "image/jpeg")
  ) {
    return invalid("The generated image metadata is invalid.");
  }

  return {
    success: true,
    data: {
      requestId,
      assetId,
      width,
      height,
      experimental: experimental === "true",
      mimeType,
      model,
      createdAt,
    },
  };
}

function parseBrandFoundation(
  value: unknown,
): BrandFoundationContent | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "positioning",
      "brandPromise",
      "audience",
      "mission",
      "values",
      "voice",
      "taglineOptions",
    ]) ||
    !isRecord(value.voice) ||
    !hasOnlyKeys(value.voice, ["traits", "principles", "avoid"])
  ) {
    return null;
  }

  const positioning = readText(value.positioning, 1, 900);
  const brandPromise = readText(value.brandPromise, 1, 500);
  const audience = readText(value.audience, 1, 700);
  const mission = readText(value.mission, 1, 700);
  const values = readTextArray(value.values, 3, 6, 100);
  const traits = readTextArray(value.voice.traits, 3, 6, 80);
  const principles = readTextArray(
    value.voice.principles,
    3,
    6,
    180,
  );
  const avoid = readTextArray(value.voice.avoid, 2, 6, 140);
  const taglineOptions = readTextArray(
    value.taglineOptions,
    3,
    6,
    120,
  );

  if (
    !positioning ||
    !brandPromise ||
    !audience ||
    !mission ||
    !values ||
    !traits ||
    !principles ||
    !avoid ||
    !taglineOptions
  ) {
    return null;
  }

  return {
    positioning,
    brandPromise,
    audience,
    mission,
    values,
    voice: {
      traits,
      principles,
      avoid,
    },
    taglineOptions,
  };
}

function parseWebsiteCopy(
  value: unknown,
): WebsiteCopyContent | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["seo", "hero", "sections"]) ||
    !isRecord(value.seo) ||
    !hasOnlyKeys(value.seo, ["title", "description", "keywords"]) ||
    !isRecord(value.hero) ||
    !hasOnlyKeys(value.hero, [
      "eyebrow",
      "title",
      "subtitle",
      "primaryCta",
      "secondaryCta",
    ]) ||
    !Array.isArray(value.sections) ||
    value.sections.length < 3 ||
    value.sections.length > 6
  ) {
    return null;
  }

  const seoTitle = readText(value.seo.title, 1, 70);
  const seoDescription = readText(value.seo.description, 1, 180);
  const keywords = readTextArray(value.seo.keywords, 3, 10, 60);
  const eyebrow = readText(value.hero.eyebrow, 1, 80);
  const title = readText(value.hero.title, 1, 140);
  const subtitle = readText(value.hero.subtitle, 1, 320);
  const primaryCta = readText(value.hero.primaryCta, 1, 60);
  const secondaryCta = readText(value.hero.secondaryCta, 1, 60);
  const sections: WebsiteCopyContent["sections"] = [];

  for (const section of value.sections) {
    if (
      !isRecord(section) ||
      !hasOnlyKeys(section, ["id", "title", "body", "cta"])
    ) {
      return null;
    }

    const id = readText(section.id, 1, 40);
    const sectionTitle = readText(section.title, 1, 120);
    const body = readText(section.body, 1, 700);
    const cta = readText(section.cta, 1, 60);

    if (
      !id ||
      !SECTION_ID_PATTERN.test(id) ||
      !sectionTitle ||
      !body ||
      !cta
    ) {
      return null;
    }

    sections.push({
      id,
      title: sectionTitle,
      body,
      cta,
    });
  }

  if (
    !seoTitle ||
    !seoDescription ||
    !keywords ||
    !eyebrow ||
    !title ||
    !subtitle ||
    !primaryCta ||
    !secondaryCta
  ) {
    return null;
  }

  return {
    seo: {
      title: seoTitle,
      description: seoDescription,
      keywords,
    },
    hero: {
      eyebrow,
      title,
      subtitle,
      primaryCta,
      secondaryCta,
    },
    sections,
  };
}

function parseSocialKit(
  value: unknown,
): SocialKitContent | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "bio",
      "launchCaption",
      "contentPillars",
      "postIdeas",
    ]) ||
    !Array.isArray(value.postIdeas) ||
    value.postIdeas.length < 3 ||
    value.postIdeas.length > 6
  ) {
    return null;
  }

  const bio = readText(value.bio, 1, 300);
  const launchCaption = readText(value.launchCaption, 1, 1_800);
  const contentPillars = readTextArray(
    value.contentPillars,
    3,
    6,
    160,
  );
  const postIdeas: SocialKitContent["postIdeas"] = [];

  for (const idea of value.postIdeas) {
    if (
      !isRecord(idea) ||
      !hasOnlyKeys(idea, ["title", "hook", "caption"])
    ) {
      return null;
    }

    const title = readText(idea.title, 1, 120);
    const hook = readText(idea.hook, 1, 180);
    const caption = readText(idea.caption, 1, 1_200);

    if (!title || !hook || !caption) return null;
    postIdeas.push({ title, hook, caption });
  }

  if (!bio || !launchCaption || !contentPillars) return null;

  return {
    bio,
    launchCaption,
    contentPillars,
    postIdeas,
  };
}

export function validateCreativeCopyContent<
  Deliverable extends CreativeCopyDeliverable,
>(
  deliverable: Deliverable,
  value: unknown,
): CreativeValidationResult<
  CreativeCopyContentByDeliverable[Deliverable]
> {
  const parsed =
    deliverable === "brand-foundation"
      ? parseBrandFoundation(value)
      : deliverable === "website-copy"
        ? parseWebsiteCopy(value)
        : parseSocialKit(value);

  if (!parsed) {
    return invalid("The generated creative content is invalid.");
  }

  return {
    success: true,
    data: parsed as CreativeCopyContentByDeliverable[Deliverable],
  };
}
