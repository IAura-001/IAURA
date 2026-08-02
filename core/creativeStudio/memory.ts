import type { IAuraProject } from "@/types/project";
import type { SupportedLocale } from "@/core/i18n/languages";
import {
  CREATIVE_COPY_DELIVERABLES,
  CREATIVE_IMAGE_INTENTS,
  type CreativeImageIntent,
} from "@/core/creative/types";
import type {
  CreativeAssetMetadata,
  CreativeBrandBrief,
  CreativeDeliverable,
  CreativeGenerationRecord,
  CreativeLegacyImport,
  CreativeStudioMemory,
} from "@/types/creative-studio";

const BRANDING_STORAGE_PREFIX = "iaura.branding-studio.v1";
const LAUNCH_STORAGE_PREFIX = "iaura.launch-studio.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createRevisionId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `brand-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readLegacyBranding(
  project: IAuraProject,
  storage?: Storage,
): { content: Record<string, string>; sourceKey?: string } {
  const fromProject = project.brandingStudio?.generatedContent ?? {};
  const content = Object.fromEntries(
    Object.entries(fromProject)
      .map(([key, value]) => [key, cleanString(value)])
      .filter(([, value]) => Boolean(value)),
  );

  if (!storage) return { content };

  const sourceKey = `${BRANDING_STORAGE_PREFIX}.${project.id}`;

  try {
    const raw = storage.getItem(sourceKey);
    if (!raw) return { content };

    const parsed = JSON.parse(raw) as {
      generatedContent?: unknown;
    };

    if (
      typeof parsed.generatedContent === "object" &&
      parsed.generatedContent !== null
    ) {
      for (const [key, value] of Object.entries(parsed.generatedContent)) {
        const normalized = cleanString(value);
        if (normalized && !content[key]) content[key] = normalized;
      }
    }

    return { content, sourceKey };
  } catch {
    return { content };
  }
}

function readLegacyLaunch(
  project: IAuraProject,
  storage?: Storage,
): { assetIds: string[]; sourceKey?: string } {
  const ids = new Set(
    project.launchStudio?.assets
      .map((asset) => cleanString(asset.id))
      .filter(Boolean) ?? [],
  );

  if (!storage) return { assetIds: Array.from(ids) };

  const sourceKey = `${LAUNCH_STORAGE_PREFIX}.${project.id}`;

  try {
    const raw = storage.getItem(sourceKey);
    if (!raw) return { assetIds: Array.from(ids) };

    const parsed = JSON.parse(raw) as { assets?: unknown };
    if (Array.isArray(parsed.assets)) {
      for (const asset of parsed.assets) {
        if (typeof asset !== "object" || asset === null) continue;
        const id = cleanString((asset as { id?: unknown }).id);
        if (id) ids.add(id);
      }
    }

    return { assetIds: Array.from(ids), sourceKey };
  } catch {
    return { assetIds: Array.from(ids) };
  }
}

function creativeLocaleFromPreference(
  locale?: SupportedLocale,
): CreativeBrandBrief["locale"] {
  if (locale === "en-US") return "en";
  if (locale === "pt-BR") return "pt";
  if (locale === "fr-FR") return "fr";
  return "es";
}

export function createCreativeBrief(
  project: IAuraProject,
  preferredLocale?: SupportedLocale,
): CreativeBrandBrief {
  const profile = project.branding;

  return {
    brandName: profile?.brandName.trim() || project.name,
    audience: "",
    offer: project.description.trim() || project.goal.trim(),
    personality: profile?.personality.join(", ") ?? "premium, intelligent",
    visualDirection: "",
    constraints: "",
    locale: creativeLocaleFromPreference(preferredLocale),
  };
}

function normalizeBrief(
  value: unknown,
  fallback: CreativeBrandBrief,
): CreativeBrandBrief {
  if (!isRecord(value)) return fallback;

  const text = (key: string, defaultValue: string, maximum: number) => {
    const candidate = cleanString(value[key]);
    return (candidate || defaultValue).slice(0, maximum);
  };

  return {
    brandName: text("brandName", fallback.brandName, 80),
    audience: text("audience", fallback.audience, 600),
    offer: text("offer", fallback.offer, 1200),
    personality: text("personality", fallback.personality, 300),
    visualDirection: text(
      "visualDirection",
      fallback.visualDirection,
      1500,
    ),
    constraints: text("constraints", fallback.constraints, 1200),
    locale:
      value.locale === "en" ||
      value.locale === "pt" ||
      value.locale === "fr"
        ? value.locale
        : "es",
  };
}

function normalizeGeneration(
  value: unknown,
  deliverable: CreativeDeliverable,
  fallbackRevisionId: string,
  fallbackDate: string,
): CreativeGenerationRecord | null {
  if (!isRecord(value) || !("data" in value)) return null;

  return {
    deliverable,
    data: value.data,
    model: cleanString(value.model) || "unknown-model",
    brandRevisionId:
      cleanString(value.brandRevisionId) || fallbackRevisionId,
    generatedAt: cleanString(value.generatedAt) || fallbackDate,
  };
}

function normalizeAsset(
  value: unknown,
  projectId: string,
  fallbackRevisionId: string,
  fallbackDate: string,
): CreativeAssetMetadata | null {
  if (!isRecord(value)) return null;

  const id = cleanString(value.id);
  const kind = cleanString(value.kind) as CreativeImageIntent;
  const width = Number(value.width);
  const height = Number(value.height);
  const byteSize = Number(value.byteSize);
  const mimeType = cleanString(value.mimeType);
  const status = cleanString(value.status);

  if (
    !id ||
    !CREATIVE_IMAGE_INTENTS.includes(kind) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isFinite(byteSize) ||
    byteSize < 0 ||
    !["image/png", "image/webp", "image/jpeg"].includes(mimeType) ||
    !["draft", "selected", "approved", "archived"].includes(status)
  ) {
    return null;
  }

  const tier = cleanString(value.tier);

  return {
    id,
    projectId,
    kind,
    title: cleanString(value.title).slice(0, 160) || "Creative asset",
    status: status as CreativeAssetMetadata["status"],
    blobKey: cleanString(value.blobKey) || id,
    prompt: cleanString(value.prompt).slice(0, 2400),
    altText: cleanString(value.altText).slice(0, 300),
    width,
    height,
    mimeType: mimeType as CreativeAssetMetadata["mimeType"],
    byteSize,
    model: cleanString(value.model) || "unknown-model",
    quality:
      value.quality === "low" || value.quality === "medium"
        ? value.quality
        : "high",
    ...(tier === "draft" || tier === "premium" || tier === "ultra"
      ? { tier }
      : {}),
    ...(typeof value.experimental === "boolean"
      ? { experimental: value.experimental }
      : {}),
    ...(cleanString(value.requestId)
      ? { requestId: cleanString(value.requestId) }
      : {}),
    brandRevisionId:
      cleanString(value.brandRevisionId) || fallbackRevisionId,
    ...(cleanString(value.parentAssetId)
      ? { parentAssetId: cleanString(value.parentAssetId) }
      : {}),
    createdAt: cleanString(value.createdAt) || fallbackDate,
    updatedAt: cleanString(value.updatedAt) || fallbackDate,
  };
}

function sanitizeStoredCreativeStudio(
  project: IAuraProject,
  value: unknown,
): CreativeStudioMemory | undefined {
  if (!isRecord(value)) return undefined;

  const now = new Date().toISOString();
  const brandRevisionId =
    cleanString(value.brandRevisionId) || createRevisionId();
  const updatedAt = cleanString(value.updatedAt) || now;
  const fallbackBrief = createCreativeBrief(project);
  const brief = normalizeBrief(value.brief, fallbackBrief);
  const outputs: CreativeStudioMemory["outputs"] = {};
  const rawOutputs = isRecord(value.outputs) ? value.outputs : {};

  for (const deliverable of CREATIVE_COPY_DELIVERABLES) {
    const normalized = normalizeGeneration(
      rawOutputs[deliverable],
      deliverable,
      brandRevisionId,
      updatedAt,
    );
    if (normalized) outputs[deliverable] = normalized;
  }

  const outputHistory: CreativeStudioMemory["outputHistory"] = {};
  const rawHistory = isRecord(value.outputHistory) ? value.outputHistory : {};
  for (const deliverable of CREATIVE_COPY_DELIVERABLES) {
    const entries = Array.isArray(rawHistory[deliverable])
      ? rawHistory[deliverable]
      : [];
    outputHistory[deliverable] = entries
      .map((entry) =>
        normalizeGeneration(
          entry,
          deliverable,
          brandRevisionId,
          updatedAt,
        ),
      )
      .filter((entry): entry is CreativeGenerationRecord => Boolean(entry))
      .slice(0, 12);
  }

  const briefHistory = (Array.isArray(value.briefHistory)
    ? value.briefHistory
    : [])
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const id = cleanString(entry.id);
      if (!id) return null;
      return {
        id,
        brief: normalizeBrief(entry.brief, brief),
        createdAt: cleanString(entry.createdAt) || updatedAt,
      };
    })
    .filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry),
    )
    .slice(0, 20);
  const assets = (Array.isArray(value.assets) ? value.assets : [])
    .map((asset) =>
      normalizeAsset(
        asset,
        project.id,
        brandRevisionId,
        updatedAt,
      ),
    )
    .filter((asset): asset is CreativeAssetMetadata => Boolean(asset))
    .slice(0, 200);
  const rawLegacy = isRecord(value.legacyImport)
    ? value.legacyImport
    : null;
  const legacyBranding = isRecord(rawLegacy?.brandingContent)
    ? Object.fromEntries(
        Object.entries(rawLegacy.brandingContent)
          .map(([key, content]) => [key, cleanString(content)])
          .filter(([, content]) => Boolean(content)),
      )
    : {};
  const legacyImport = rawLegacy
    ? {
        brandingContent: legacyBranding,
        launchAssetIds: Array.isArray(rawLegacy.launchAssetIds)
          ? rawLegacy.launchAssetIds.map(cleanString).filter(Boolean)
          : [],
        sourceKeys: Array.isArray(rawLegacy.sourceKeys)
          ? rawLegacy.sourceKeys.map(cleanString).filter(Boolean)
          : [],
        importedAt: cleanString(rawLegacy.importedAt) || updatedAt,
      }
    : undefined;

  return {
    schemaVersion: 1,
    brief,
    brandRevisionId,
    briefHistory,
    outputs,
    outputHistory,
    assets,
    ...(legacyImport ? { legacyImport } : {}),
    updatedAt,
  };
}

export function loadCreativeStudioMemory(
  project: IAuraProject,
  storage?: Storage,
  preferredLocale?: SupportedLocale,
): CreativeStudioMemory {
  const now = new Date().toISOString();
  const current = sanitizeStoredCreativeStudio(
    project,
    project.creativeStudio as unknown,
  );
  const brandRevisionId = current?.brandRevisionId || createRevisionId();
  const legacyBranding = readLegacyBranding(project, storage);
  const legacyLaunch = readLegacyLaunch(project, storage);
  const sourceKeys = [
    legacyBranding.sourceKey,
    legacyLaunch.sourceKey,
  ].filter((value): value is string => Boolean(value));
  const hasLegacy =
    Object.keys(legacyBranding.content).length > 0 ||
    legacyLaunch.assetIds.length > 0 ||
    sourceKeys.length > 0;
  const legacyImport: CreativeLegacyImport | undefined = hasLegacy
    ? {
        brandingContent: {
          ...(current?.legacyImport?.brandingContent ?? {}),
          ...legacyBranding.content,
        },
        launchAssetIds: Array.from(
          new Set([
            ...(current?.legacyImport?.launchAssetIds ?? []),
            ...legacyLaunch.assetIds,
          ]),
        ),
        sourceKeys: Array.from(
          new Set([
            ...(current?.legacyImport?.sourceKeys ?? []),
            ...sourceKeys,
          ]),
        ),
        importedAt: current?.legacyImport?.importedAt ?? now,
      }
    : current?.legacyImport;
  const outputs = { ...(current?.outputs ?? {}) };
  const outputHistory = { ...(current?.outputHistory ?? {}) };
  const activeBrief =
    current?.brief ?? createCreativeBrief(project, preferredLocale);
  const briefHistory = [
    {
      id: brandRevisionId,
      brief: activeBrief,
      createdAt: current?.updatedAt ?? now,
    },
    ...(current?.briefHistory ?? []).filter(
      (revision) => revision.id !== brandRevisionId,
    ),
  ].slice(0, 20);

  for (const deliverable of Object.keys(outputs) as CreativeDeliverable[]) {
    const output = outputs[deliverable];
    if (!output) continue;

    const normalized: CreativeGenerationRecord = {
      ...output,
      brandRevisionId: output.brandRevisionId || brandRevisionId,
    };
    const existing = outputHistory[deliverable] ?? [];
    outputs[deliverable] = normalized;
    outputHistory[deliverable] = [
      normalized,
      ...existing.filter(
        (version) => version.generatedAt !== normalized.generatedAt,
      ),
    ].slice(0, 12);
  }

  return {
    schemaVersion: 1,
    brief: activeBrief,
    brandRevisionId,
    briefHistory,
    outputs,
    outputHistory,
    assets: current?.assets ?? [],
    legacyImport,
    updatedAt: current?.updatedAt ?? now,
  };
}

export function reviseCreativeBrief(
  memory: CreativeStudioMemory,
  brief: CreativeBrandBrief,
): CreativeStudioMemory {
  const changed = JSON.stringify(memory.brief) !== JSON.stringify(brief);
  const updatedAt = new Date().toISOString();
  const brandRevisionId = changed
    ? createRevisionId()
    : memory.brandRevisionId;
  const briefHistory = changed
    ? [
        { id: brandRevisionId, brief, createdAt: updatedAt },
        {
          id: memory.brandRevisionId,
          brief: memory.brief,
          createdAt: memory.updatedAt,
        },
        ...memory.briefHistory,
      ].filter(
        (revision, index, revisions) =>
          revisions.findIndex((candidate) => candidate.id === revision.id) ===
          index,
      ).slice(0, 20)
    : memory.briefHistory;

  return {
    ...memory,
    brief,
    brandRevisionId,
    briefHistory,
    updatedAt,
  };
}
