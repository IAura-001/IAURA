"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  type CreativeBrandContext,
  type CreativeCopyDeliverable,
  type CreativeImageAspect,
  type CreativeImageIntent,
  type CreativeImageTier,
} from "@/core/creative/types";
import { validateCreativeCopyContent } from "@/core/creative/validation";
import {
  loadCreativeStudioMemory,
  reviseCreativeBrief,
} from "@/core/creativeStudio/memory";
import { projectEngine } from "@/core/project/ProjectEngine";
import {
  creativeAssetRepository,
  type CreativeAssetPageCursor,
} from "@/core/storage/CreativeAssetRepository";
import { createImageThumbnail } from "@/core/storage/createImageThumbnail";
import {
  CreativeClientError,
  generateCreativeCopy,
  generateCreativeImage,
} from "@/services/creative";
import type {
  CreativeAssetMetadata,
  CreativeBrandBrief,
  CreativeStudioArea,
  CreativeStudioMemory,
  StoredCreativeAsset,
  StoredCreativeAssetSummary,
} from "@/types/creative-studio";
import type { IAuraProject } from "@/types/project";
import type { SupportedLocale } from "@/core/i18n/languages";

import styles from "./CreativeStudio.module.css";
import StructuredCreativeOutput from "./StructuredCreativeOutput";

interface CreativeStudioProps {
  project: IAuraProject;
  initialArea?: CreativeStudioArea;
  preferredLocale?: SupportedLocale;
  onClose: () => void;
  onProjectUpdated?: (project: IAuraProject) => void;
}

interface AssetView extends StoredCreativeAssetSummary {
  blob?: Blob;
  originalUrl?: string;
  thumbnailUrl?: string;
  persisted: boolean;
}

interface FeedbackState {
  message: string;
  error: boolean;
}

type BrandKitItemStatus =
  | "pending"
  | "generating"
  | "ready"
  | "session-only"
  | "paused"
  | "error"
  | "cancelled";

interface BrandKitProgressItem {
  intent: CreativeImageIntent;
  label: string;
  aspect: CreativeImageAspect;
  status: BrandKitItemStatus;
  assetId?: string;
  message?: string;
}

interface GeneratedAssetOutcome {
  metadata: CreativeAssetMetadata;
  persisted: boolean;
}

interface AreaDefinition {
  id: CreativeStudioArea;
  index: string;
  label: string;
  description: string;
}

const AREAS: readonly AreaDefinition[] = [
  {
    id: "direction",
    index: "01",
    label: "Direction",
    description: "Strategy & voice",
  },
  {
    id: "image",
    index: "02",
    label: "Image Lab",
    description: "Logos & imagery",
  },
  {
    id: "website",
    index: "03",
    label: "Website Kit",
    description: "Complete web copy",
  },
  {
    id: "library",
    index: "04",
    label: "Library",
    description: "Versions & exports",
  },
] as const;

const IMAGE_INTENTS: ReadonlyArray<{
  id: CreativeImageIntent;
  label: string;
  description: string;
  aspect: CreativeImageAspect;
}> = [
  {
    id: "logo-mark",
    label: "Logo concept",
    description: "Symbol only",
    aspect: "square",
  },
  {
    id: "website-hero",
    label: "Website hero",
    description: "Wide atmosphere",
    aspect: "hero",
  },
  {
    id: "editorial-photo",
    label: "Brand photo",
    description: "Editorial image",
    aspect: "landscape",
  },
  {
    id: "product-shot",
    label: "Product shot",
    description: "Premium object",
    aspect: "square",
  },
  {
    id: "social-visual",
    label: "Social visual",
    description: "Campaign asset",
    aspect: "portrait",
  },
  {
    id: "brand-texture",
    label: "Brand texture",
    description: "Abstract field",
    aspect: "landscape",
  },
];

const BRAND_KIT_ITEMS: ReadonlyArray<{
  intent: CreativeImageIntent;
  label: string;
  aspect: CreativeImageAspect;
}> = IMAGE_INTENTS.map(({ id, label, aspect }) => ({
  intent: id,
  label,
  aspect,
}));

const BRAND_KIT_STATUS_LABELS: Record<BrandKitItemStatus, string> = {
  pending: "Pendiente",
  generating: "Generando",
  ready: "Guardado",
  "session-only": "Solo sesión",
  paused: "Pausado",
  error: "Error",
  cancelled: "Cancelado",
};

const BRAND_KIT_STATUS_MARKS: Record<BrandKitItemStatus, string> = {
  pending: "○",
  generating: "…",
  ready: "✓",
  "session-only": "↓",
  paused: "Ⅱ",
  error: "!",
  cancelled: "—",
};

const MAX_BRAND_KIT_AUTO_RETRY_SECONDS = 30;

function isBrandKitItemReady(status: BrandKitItemStatus): boolean {
  return status === "ready" || status === "session-only";
}

function createBrandKitOperationId(): string {
  return `brand-kit-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function waitForBrandKitRetry(
  seconds: number,
  signal: AbortSignal,
  onTick: (remainingSeconds: number) => void,
): Promise<void> {
  const totalSeconds = Math.max(1, Math.ceil(seconds));

  for (let remaining = totalSeconds; remaining > 0; remaining -= 1) {
    if (signal.aborted) {
      throw new DOMException("Brand Kit generation cancelled.", "AbortError");
    }

    onTick(remaining);
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        signal.removeEventListener("abort", handleAbort);
        resolve();
      }, 1_000);
      const handleAbort = () => {
        window.clearTimeout(timeout);
        reject(
          new DOMException("Brand Kit generation cancelled.", "AbortError"),
        );
      };

      signal.addEventListener("abort", handleAbort, { once: true });
    });
  }
}

const ASPECTS: ReadonlyArray<{
  id: CreativeImageAspect;
  label: string;
  description: string;
}> = [
  { id: "square", label: "Square", description: "1:1" },
  { id: "portrait", label: "Portrait", description: "2:3" },
  {
    id: "landscape",
    label: "Landscape",
    description: "3:2 · Ultra 16:9",
  },
  { id: "hero", label: "Hero", description: "Safe 16:9 crop" },
];

const TIERS: ReadonlyArray<{
  id: CreativeImageTier;
  label: string;
  description: string;
}> = [
  { id: "draft", label: "Explore", description: "Vista previa rápida" },
  { id: "premium", label: "Studio", description: "Alta calidad" },
  { id: "ultra", label: "Ultra 4K", description: "Final experimental" },
];

const TIER_LABELS: Record<CreativeImageTier, string> = {
  draft: "Explore",
  premium: "Studio",
  ultra: "Ultra 4K",
};

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function imageFormationPhase(seconds: number): string {
  if (seconds < 5) return "Organizando la dirección visual";
  if (seconds < 18) return "Formando la composición";
  if (seconds < 45) return "Refinando luz, materia y detalle";
  return "Completando el render final";
}

const INTENT_LABELS: Record<CreativeImageIntent, string> = {
  "logo-mark": "Logo concept",
  "brand-texture": "Brand texture",
  "website-hero": "Website hero",
  "editorial-photo": "Editorial brand photo",
  "product-shot": "Product shot",
  "social-visual": "Social visual",
};

const DEFAULT_PALETTE = {
  primary: "#6D5CE7",
  secondary: "#334FC6",
  accent: "#A89CFF",
  background: "#050509",
  text: "#F4F2F8",
} as const;

const MAX_OUTPUT_VERSIONS = 12;
const ASSET_PAGE_SIZE = 6;

function subscribeClientSnapshot(): () => void {
  return () => undefined;
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

function createAssetView(
  asset: StoredCreativeAsset | StoredCreativeAssetSummary,
  persisted: boolean,
): AssetView {
  const blob = "blob" in asset ? asset.blob : undefined;
  const keepOriginalInMemory = Boolean(blob && !persisted);

  return {
    metadata: asset.metadata,
    ...(asset.thumbnail ? { thumbnail: asset.thumbnail } : {}),
    ...(keepOriginalInMemory && blob ? { blob } : {}),
    ...(keepOriginalInMemory && blob && !asset.thumbnail
      ? { originalUrl: URL.createObjectURL(blob) }
      : {}),
    ...(asset.thumbnail
      ? { thumbnailUrl: URL.createObjectURL(asset.thumbnail) }
      : {}),
    persisted,
  };
}

function revokeAssetView(view: AssetView): void {
  if (view.originalUrl) URL.revokeObjectURL(view.originalUrl);
  if (view.thumbnailUrl) URL.revokeObjectURL(view.thumbnailUrl);
}

function releaseOriginalPreview(view: AssetView): AssetView {
  if (!view.originalUrl) return view;
  URL.revokeObjectURL(view.originalUrl);
  const next = { ...view };
  delete next.originalUrl;
  return next;
}

function cleanFileName(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || "vaeora-asset";
}

function splitPersonality(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5);
}

function buildBrandContext(
  project: IAuraProject,
  brief: CreativeBrandBrief,
): CreativeBrandContext {
  const profile = project.branding;
  const personality = splitPersonality(brief.personality);

  return {
    name: brief.brandName.trim().slice(0, 80),
    slogan: profile?.slogan.trim().slice(0, 180) || undefined,
    mission: profile?.mission.trim().slice(0, 1500) || undefined,
    personality: personality.length > 0 ? personality : undefined,
    palette: profile?.palette ?? DEFAULT_PALETTE,
    visualDirection:
      brief.visualDirection.trim().slice(0, 1500) || undefined,
  };
}

function buildCreativeBriefText(
  project: IAuraProject,
  brief: CreativeBrandBrief,
): string {
  return [
    `Project objective: ${project.goal || project.description || brief.offer}`,
    `Audience: ${brief.audience}`,
    `Offer: ${brief.offer}`,
    `Brand personality: ${brief.personality}`,
    `Visual direction: ${brief.visualDirection || "Open to a refined creative direction."}`,
    brief.constraints ? `Constraints: ${brief.constraints}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

function assetExtension(mimeType: CreativeAssetMetadata["mimeType"]): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function formatStorageBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const megabytes = value / (1024 * 1024);
  return `${megabytes >= 1024 ? (megabytes / 1024).toFixed(1) + " GB" : Math.round(megabytes) + " MB"}`;
}

function creativeFailureMessage(error: unknown, fallback: string): string {
  if (!(error instanceof CreativeClientError)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (error.code === "IAURA_ACCESS_NOT_CONFIGURED") {
    return "Configura el acceso privado de IAURA antes de usar generación creativa.";
  }
  if (error.code === "IAURA_ACCESS_REQUIRED") {
    return "La sesión privada expiró. Vuelve a entrar en IAURA para generar.";
  }
  if (error.code === "VAEORA_RATE_LIMITED") {
    return error.retryAfter
      ? `El estudio alcanzó su límite temporal. Inténtalo en ${error.retryAfter} s.`
      : "El estudio está ocupado. Inténtalo de nuevo en unos segundos.";
  }
  if (error.code === "VAEORA_CONTENT_REJECTED") {
    return "La solicitud necesita una dirección visual diferente para poder generarse.";
  }
  if (error.code === "VAEORA_PROVIDER_TIMEOUT") {
    return "La generación tardó demasiado. Tu dirección sigue guardada; puedes intentarlo otra vez.";
  }
  if (
    error.code === "VAEORA_CREATIVE_NOT_CONFIGURED" ||
    error.code === "VAEORA_PROVIDER_ERROR"
  ) {
    return "El motor creativo no está disponible en este momento. Nada se perdió.";
  }

  return error.message || fallback;
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("es", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function sameAsset(left: CreativeAssetMetadata, right: CreativeAssetMetadata) {
  return left.id === right.id;
}

export default function CreativeStudio({
  project,
  initialArea = "direction",
  preferredLocale,
  onClose,
  onProjectUpdated,
}: CreativeStudioProps) {
  const projectSnapshotRef = useRef(project);
  const studioRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasFocusedCloseRef = useRef(false);
  const memoryRef = useRef<CreativeStudioMemory | null>(null);
  const briefRef = useRef<CreativeBrandBrief | null>(null);
  const assetViewsRef = useRef<AssetView[]>([]);
  const assetPageCursorRef = useRef<CreativeAssetPageCursor | null>(null);
  const copyAbortRef = useRef<AbortController | null>(null);
  const imageAbortRef = useRef<AbortController | null>(null);
  const brandKitOperationIdRef = useRef<string | null>(null);
  const assetStatusRequestsRef = useRef(new Set<string>());
  const assetDownloadRequestsRef = useRef(new Set<string>());
  const lifecycleRef = useRef(0);
  const pendingPersistenceRef = useRef(0);
  const outputEditorDirtyRef = useRef(false);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const [area, setArea] = useState<CreativeStudioArea>(initialArea);
  const [memory, setMemory] = useState<CreativeStudioMemory | null>(null);
  const [brief, setBrief] = useState<CreativeBrandBrief | null>(null);
  const [assetViews, setAssetViews] = useState<AssetView[]>([]);
  const [hasMoreAssets, setHasMoreAssets] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [imageIntent, setImageIntent] =
    useState<CreativeImageIntent>("logo-mark");
  const [imageAspect, setImageAspect] =
    useState<CreativeImageAspect>("square");
  const [imageTier, setImageTier] =
    useState<CreativeImageTier>("draft");
  const [imagePrompt, setImagePrompt] = useState("");
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] =
    useState<CreativeCopyDeliverable | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [brandKitLoading, setBrandKitLoading] = useState(false);
  const [brandKitProgress, setBrandKitProgress] = useState<
    BrandKitProgressItem[]
  >([]);
  const [brandKitRetryAt, setBrandKitRetryAt] = useState<number | null>(null);
  const [brandKitRetrySeconds, setBrandKitRetrySeconds] = useState(0);
  const [imageElapsedSeconds, setImageElapsedSeconds] = useState(0);
  const [assetBusyIds, setAssetBusyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [assetDownloadIds, setAssetDownloadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [storageChecking, setStorageChecking] = useState(false);
  const [storageSummary, setStorageSummary] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({
    message: "",
    error: false,
  });
  const canUsePortal = useSyncExternalStore(
    subscribeClientSnapshot,
    getClientSnapshot,
    getServerSnapshot,
  );

  function renderStudio(content: ReactNode) {
    return canUsePortal ? createPortal(content, document.body) : content;
  }

  useEffect(() => {
    projectSnapshotRef.current = project;
  }, [project]);

  useEffect(() => {
    briefRef.current = brief;
  }, [brief]);

  useEffect(() => {
    if (!imageLoading) return;

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setImageElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)),
      );
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [imageLoading]);

  useEffect(() => {
    if (brandKitRetryAt === null) return;

    const updateRetryCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((brandKitRetryAt - Date.now()) / 1_000),
      );
      setBrandKitRetrySeconds(remaining);

      if (remaining === 0) {
        setBrandKitRetryAt(null);
        setBrandKitProgress((current) =>
          current.map((item) =>
            item.status === "paused"
              ? { ...item, message: "Listo para reintentar" }
              : item,
          ),
        );
      }
    };

    const interval = window.setInterval(updateRetryCountdown, 1_000);
    return () => window.clearInterval(interval);
  }, [brandKitRetryAt]);

  const requestClose = useCallback(() => {
    const currentMemory = memoryRef.current;
    const currentBrief = briefRef.current;
    const hasUnsavedDirection = Boolean(
      currentMemory &&
      currentBrief &&
      JSON.stringify(currentMemory.brief) !== JSON.stringify(currentBrief),
    );
    const hasGenerationInProgress = Boolean(
      copyAbortRef.current || imageAbortRef.current,
    );
    const hasPersistenceInProgress = pendingPersistenceRef.current > 0;
    const hasUnsavedOutputEdit = outputEditorDirtyRef.current;
    const hasSessionOnlyAssets = assetViewsRef.current.some(
      (asset) => !asset.persisted,
    );
    const requiresConfirmation =
      hasUnsavedDirection ||
      hasGenerationInProgress ||
      hasPersistenceInProgress ||
      hasUnsavedOutputEdit ||
      hasSessionOnlyAssets;
    const confirmationMessage = hasGenerationInProgress
      ? "Hay una generación en curso. Si cierras, se cancelará. ¿Continuar?"
      : hasPersistenceInProgress
        ? "VAEORA todavía está guardando un asset local. Si cierras ahora, podría quedar solo en esta sesión. ¿Continuar?"
        : hasUnsavedOutputEdit
          ? "Hay una edición de contenido sin guardar. ¿Cerrar de todas formas?"
          : hasUnsavedDirection
            ? "Hay cambios de dirección sin guardar. ¿Cerrar de todas formas?"
            : "Hay imágenes disponibles solo durante esta sesión. Descárgalas antes de cerrar o se perderán. ¿Continuar?";

    if (
      requiresConfirmation &&
      !window.confirm(confirmationMessage)
    ) {
      return;
    }

    onClose();
  }, [onClose]);

  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  useEffect(() => {
    const snapshot = projectSnapshotRef.current;
    const lifecycle = lifecycleRef.current + 1;
    lifecycleRef.current = lifecycle;
    let cancelled = false;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const inerted: Array<{
      element: HTMLElement;
      inert: boolean;
      ariaHidden: string | null;
    }> = [];
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let dialogBranch: HTMLElement | null = studioRef.current;
    while (dialogBranch?.parentElement) {
      const parent: HTMLElement = dialogBranch.parentElement;

      for (const sibling of Array.from(parent.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === dialogBranch) {
          continue;
        }

        inerted.push({
          element: sibling,
          inert: sibling.inert,
          ariaHidden: sibling.getAttribute("aria-hidden"),
        });
        sibling.inert = true;
        sibling.setAttribute("aria-hidden", "true");
      }

      if (parent === document.body) break;
      dialogBranch = parent;
    }

    const loadedMemory = loadCreativeStudioMemory(
      snapshot,
      window.localStorage,
      preferredLocale,
    );
    memoryRef.current = loadedMemory;
    setMemory(loadedMemory);
    setBrief(loadedMemory.brief);

    const synchronizedProject = projectEngine.updateCreativeStudio(
      snapshot.id,
      loadedMemory,
    );
    onProjectUpdated?.(synchronizedProject);
    if (projectEngine.didLastPersistenceSucceed?.() === false) {
      setFeedback({
        message:
          "La memoria estructurada está activa solo en esta sesión porque el navegador no permitió guardarla.",
        error: true,
      });
    }

    void creativeAssetRepository
      .listPage(snapshot.id, { limit: ASSET_PAGE_SIZE })
      .then((page) => {
        if (cancelled || lifecycleRef.current !== lifecycle) return;

        const loadedViews = page.assets.map((asset) =>
          createAssetView(asset, true),
        );
        const existingIds = new Set(
          assetViewsRef.current.map((asset) => asset.metadata.id),
        );
        const uniqueLoadedViews = loadedViews.filter((asset) => {
          if (!existingIds.has(asset.metadata.id)) return true;
          revokeAssetView(asset);
          return false;
        });
        const mergedViews = [
          ...assetViewsRef.current,
          ...uniqueLoadedViews,
        ];
        assetViewsRef.current = mergedViews;
        assetPageCursorRef.current = page.nextCursor;
        setAssetViews(mergedViews);
        setHasMoreAssets(page.hasMore);
        setLibraryLoading(false);
        setActiveAssetId((current) => current ?? mergedViews[0]?.metadata.id ?? null);
      })
      .catch(() => {
        if (!cancelled && lifecycleRef.current === lifecycle) {
          setLibraryLoading(false);
          setFeedback({
            message:
              "La biblioteca visual no está disponible en este navegador. Puedes seguir generando y descargar el resultado durante esta sesión.",
            error: true,
          });
        }
      });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        studioRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => {
        const closedDetails = element.closest("details:not([open])");
        return (
          !element.closest("[hidden]") &&
          (!closedDetails || element.tagName === "SUMMARY")
        );
      });

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !studioRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !studioRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current += 1;
      }
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      for (const state of inerted.reverse()) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) {
          state.element.removeAttribute("aria-hidden");
        } else {
          state.element.setAttribute("aria-hidden", state.ariaHidden);
        }
      }
      copyAbortRef.current?.abort();
      imageAbortRef.current?.abort();
      for (const asset of assetViewsRef.current) {
        revokeAssetView(asset);
      }
      memoryRef.current = null;
      assetViewsRef.current = [];
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onProjectUpdated, preferredLocale, project.id]);

  useEffect(() => {
    if (memory && !hasFocusedCloseRef.current) {
      hasFocusedCloseRef.current = true;
      closeButtonRef.current?.focus();
    }
  }, [memory]);

  const activeAsset = useMemo(
    () =>
      assetViews.find((asset) => asset.metadata.id === activeAssetId) ??
      assetViews[0] ??
      null,
    [activeAssetId, assetViews],
  );
  const activeAssetPreviewUrl =
    activeAsset?.thumbnailUrl ?? activeAsset?.originalUrl;

  useEffect(() => {
    if (
      !activeAsset ||
      area !== "image" ||
      activeAsset.thumbnailUrl ||
      activeAsset.originalUrl ||
      !activeAsset.persisted
    ) {
      return;
    }

    const assetId = activeAsset.metadata.id;
    const lifecycle = lifecycleRef.current;
    let ignored = false;

    void creativeAssetRepository
      .get(assetId)
      .then((stored) => {
        if (!stored || ignored || !isActiveLifecycle(lifecycle)) return;

        const originalUrl = URL.createObjectURL(stored.blob);
        if (ignored || !isActiveLifecycle(lifecycle)) {
          URL.revokeObjectURL(originalUrl);
          return;
        }

        const nextViews = assetViewsRef.current.map((view) => {
          if (view.metadata.id === assetId) {
            return { ...view, originalUrl };
          }
          if (view.persisted && !view.thumbnailUrl && view.originalUrl) {
            return releaseOriginalPreview(view);
          }
          return view;
        });
        assetViewsRef.current = nextViews;
        setAssetViews(nextViews);
      })
      .catch(() => {
        if (!ignored && isActiveLifecycle(lifecycle)) {
          showFeedback(
            "No se pudo preparar la vista previa del original local.",
            true,
          );
        }
      });

    return () => {
      ignored = true;
    };
  }, [activeAsset, area]);

  const currentArea =
    AREAS.find((definition) => definition.id === area) ?? AREAS[0];
  const directionChanged = Boolean(
    memory && brief && JSON.stringify(memory.brief) !== JSON.stringify(brief),
  );
  const canGenerate = Boolean(
    brief?.brandName.trim() && brief.audience.trim() && brief.offer.trim(),
  );
  const completedBrandKitCount = brandKitProgress.filter((item) =>
    isBrandKitItemReady(item.status),
  ).length;
  const incompleteBrandKitCount = brandKitProgress.length
    ? BRAND_KIT_ITEMS.length - completedBrandKitCount
    : 0;

  function showFeedback(message: string, error = false): void {
    setFeedback({ message, error });
  }

  function isActiveLifecycle(lifecycle: number): boolean {
    return lifecycleRef.current === lifecycle;
  }

  function requestAreaChange(nextArea: CreativeStudioArea): void {
    if (nextArea === area) return;

    if (
      outputEditorDirtyRef.current &&
      !window.confirm(
        "Hay una edición de contenido sin guardar. ¿Cambiar de área y descartarla?",
      )
    ) {
      return;
    }

    outputEditorDirtyRef.current = false;
    if (area === "image" && nextArea !== "image") {
      const nextViews = assetViewsRef.current.map((view) =>
        view.persisted && !view.thumbnailUrl && view.originalUrl
          ? releaseOriginalPreview(view)
          : view,
      );
      assetViewsRef.current = nextViews;
      setAssetViews(nextViews);
    }
    setArea(nextArea);
  }

  function commitMemory(
    nextMemory: CreativeStudioMemory,
    message?: string,
  ): IAuraProject {
    memoryRef.current = nextMemory;
    setMemory(nextMemory);
    const updatedProject = projectEngine.updateCreativeStudio(
      project.id,
      nextMemory,
    );
    onProjectUpdated?.(updatedProject);
    if (projectEngine.didLastPersistenceSucceed?.() === false) {
      showFeedback(
        "El cambio está activo solo en esta sesión. Libera espacio o permite almacenamiento antes de cerrar.",
        true,
      );
    } else if (message) {
      showFeedback(message);
    }
    return updatedProject;
  }

  function saveDirection(): CreativeStudioMemory | null {
    const currentMemory = memoryRef.current;
    if (!currentMemory || !brief) return null;

    if (!brief.brandName.trim()) {
      showFeedback("La dirección necesita un nombre de marca.", true);
      return null;
    }

    const normalizedBrief: CreativeBrandBrief = {
      ...brief,
      brandName: brief.brandName.trim().slice(0, 80),
      audience: brief.audience.trim().slice(0, 600),
      offer: brief.offer.trim().slice(0, 1200),
      personality: brief.personality.trim().slice(0, 300),
      visualDirection: brief.visualDirection.trim().slice(0, 1500),
      constraints: brief.constraints.trim().slice(0, 1200),
    };
    const nextMemory = reviseCreativeBrief(currentMemory, normalizedBrief);
    setBrief(normalizedBrief);
    commitMemory(
      nextMemory,
      nextMemory.brandRevisionId !== currentMemory.brandRevisionId
        ? "Nueva revisión de marca guardada. Los assets anteriores siguen intactos."
        : "Dirección de marca guardada.",
    );
    return nextMemory;
  }

  async function handleGenerateCopy(
    deliverable: CreativeCopyDeliverable,
  ): Promise<void> {
    const availableMemory = memoryRef.current;
    if (!availableMemory || !brief || copyLoading || copyAbortRef.current) {
      return;
    }
    if (!canGenerate) {
      showFeedback(
        "Completa nombre, audiencia y oferta antes de generar un sistema.",
        true,
      );
      return;
    }

    const currentMemory = directionChanged ? saveDirection() : availableMemory;
    if (!currentMemory) return;

    const lifecycle = lifecycleRef.current;
    const controller = new AbortController();
    copyAbortRef.current = controller;
    setCopyLoading(deliverable);
    showFeedback("");

    try {
      const result = await generateCreativeCopy(
        {
          projectId: project.id,
          deliverable,
          locale: currentMemory.brief.locale,
          brief: buildCreativeBriefText(project, currentMemory.brief),
          brand: buildBrandContext(project, currentMemory.brief),
        },
        controller.signal,
      );

      if (!isActiveLifecycle(lifecycle)) return;

      const latestMemory = memoryRef.current ?? currentMemory;
      const generatedVersion = {
        deliverable,
        data: result.content,
        model: result.model,
        brandRevisionId: currentMemory.brandRevisionId,
        generatedAt: result.createdAt,
      };
      const activateGeneratedVersion =
        latestMemory.brandRevisionId === currentMemory.brandRevisionId ||
        !latestMemory.outputs[deliverable];
      const nextMemory: CreativeStudioMemory = {
        ...latestMemory,
        outputs: {
          ...latestMemory.outputs,
          [deliverable]: activateGeneratedVersion
            ? generatedVersion
            : latestMemory.outputs[deliverable],
        },
        outputHistory: {
          ...latestMemory.outputHistory,
          [deliverable]: [
            generatedVersion,
            ...(latestMemory.outputHistory[deliverable] ?? []).filter(
              (version) => version.generatedAt !== generatedVersion.generatedAt,
            ),
          ].slice(0, MAX_OUTPUT_VERSIONS),
        },
        updatedAt: new Date().toISOString(),
      };
      commitMemory(
        nextMemory,
        activateGeneratedVersion
          ? "Sistema generado y conectado a la memoria de Aura."
          : "La dirección cambió durante la generación. La versión se preservó en el historial sin reemplazar el sistema activo.",
      );
    } catch (error) {
      if (
        isActiveLifecycle(lifecycle) &&
        (error as Error).name !== "AbortError"
      ) {
        showFeedback(
          creativeFailureMessage(
            error,
            "No se pudo generar el sistema creativo.",
          ),
          true,
        );
      }
    } finally {
      if (copyAbortRef.current === controller) copyAbortRef.current = null;
      if (isActiveLifecycle(lifecycle)) setCopyLoading(null);
    }
  }

  function selectIntent(intent: CreativeImageIntent): void {
    const definition = IMAGE_INTENTS.find((item) => item.id === intent);
    setImageIntent(intent);
    if (definition) {
      setImageAspect(definition.aspect);
      if (
        imageTier === "ultra" &&
        definition.aspect !== "landscape" &&
        definition.aspect !== "hero"
      ) {
        setImageTier("premium");
      }
    }
    showFeedback("");
  }

  async function generateAndStoreImageAsset({
    intent,
    aspect,
    requestedTier,
    prompt,
    currentMemory,
    controller,
    lifecycle,
    onPreviewReady,
    operationId,
  }: {
    intent: CreativeImageIntent;
    aspect: CreativeImageAspect;
    requestedTier: CreativeImageTier;
    prompt: string;
    currentMemory: CreativeStudioMemory;
    controller: AbortController;
    lifecycle: number;
    onPreviewReady?: (metadata: CreativeAssetMetadata) => void;
    operationId?: string;
  }): Promise<GeneratedAssetOutcome> {
    const result = await generateCreativeImage(
      {
        projectId: project.id,
        intent,
        aspect,
        tier: requestedTier,
        brief: [
          prompt,
          "This asset belongs to one coordinated brand system. Preserve a shared visual grammar, palette, material language and art direction across every deliverable while adapting the composition to this asset's purpose.",
          buildCreativeBriefText(project, currentMemory.brief),
        ]
          .join("\n")
          .slice(0, 3000),
        brand: buildBrandContext(project, currentMemory.brief),
        ...(operationId ? { operationId } : {}),
      },
      controller.signal,
    );

    if (!isActiveLifecycle(lifecycle)) {
      throw new DOMException("Creative Studio closed.", "AbortError");
    }

    const now = result.metadata.createdAt;
    const latestMemory = memoryRef.current ?? currentMemory;
    const existingVersionCount = Math.max(
      latestMemory.assets.filter((asset) => asset.kind === intent).length,
      assetViewsRef.current.filter((asset) => asset.metadata.kind === intent)
        .length,
    );
    const metadata: CreativeAssetMetadata = {
      id: result.metadata.assetId,
      projectId: project.id,
      kind: intent,
      title: `${INTENT_LABELS[intent]} · ${existingVersionCount + 1}`,
      status: "draft",
      blobKey: result.metadata.assetId,
      prompt,
      altText: `${INTENT_LABELS[intent]} para ${
        currentMemory.brief.brandName
      }`.slice(0, 160),
      width: result.metadata.width,
      height: result.metadata.height,
      mimeType: result.metadata.mimeType,
      byteSize: result.blob.size,
      model: result.metadata.model,
      quality: requestedTier === "draft" ? "low" : "high",
      tier: requestedTier,
      experimental: result.metadata.experimental,
      requestId: result.metadata.requestId,
      brandRevisionId: currentMemory.brandRevisionId,
      createdAt: now,
      updatedAt: now,
    };

    const sessionView = createAssetView(
      {
        metadata,
        blob: result.blob,
      },
      false,
    );
    assetViewsRef.current = [
      sessionView,
      ...assetViewsRef.current.filter(
        (asset) => asset.metadata.id !== metadata.id,
      ),
    ];
    setAssetViews((current) => [
      sessionView,
      ...current.filter((asset) => asset.metadata.id !== metadata.id),
    ]);
    setActiveAssetId(metadata.id);
    onPreviewReady?.(metadata);

    pendingPersistenceRef.current += 1;
    let thumbnail: Blob | undefined;
    let persisted = false;

    try {
      try {
        thumbnail = await createImageThumbnail(result.blob);
        if (!isActiveLifecycle(lifecycle)) {
          throw new DOMException("Creative Studio closed.", "AbortError");
        }

        await creativeAssetRepository.put(metadata, result.blob, thumbnail);
        persisted = true;
      } catch (error) {
        if ((error as Error).name === "AbortError") throw error;
      }
    } finally {
      pendingPersistenceRef.current = Math.max(
        0,
        pendingPersistenceRef.current - 1,
      );
    }

    if (!isActiveLifecycle(lifecycle)) {
      throw new DOMException("Creative Studio closed.", "AbortError");
    }

    if (persisted) {
      const persistedView = createAssetView(
        {
          metadata,
          ...(thumbnail ? { thumbnail } : {}),
        },
        true,
      );
      const previousView = assetViewsRef.current.find(
        (asset) => asset.metadata.id === metadata.id,
      );
      if (previousView) revokeAssetView(previousView);
      assetViewsRef.current = assetViewsRef.current.map((asset) =>
        asset.metadata.id === metadata.id ? persistedView : asset,
      );
      setAssetViews((current) =>
        current.map((asset) =>
          asset.metadata.id === metadata.id ? persistedView : asset,
        ),
      );

      const memoryBeforeCommit = memoryRef.current ?? latestMemory;
      const nextMemory: CreativeStudioMemory = {
        ...memoryBeforeCommit,
        assets: [
          metadata,
          ...memoryBeforeCommit.assets.filter(
            (asset) => !sameAsset(asset, metadata),
          ),
        ],
        updatedAt: now,
      };
      commitMemory(nextMemory);
    }

    return { metadata, persisted };
  }

  async function handleGenerateImage(
    requestedTier: CreativeImageTier = imageTier,
  ): Promise<void> {
    const availableMemory = memoryRef.current;
    if (!availableMemory || !brief || imageLoading || imageAbortRef.current) {
      return;
    }
    if (!canGenerate) {
      showFeedback(
        "Completa nombre, audiencia y oferta antes de generar una imagen.",
        true,
      );
      return;
    }

    const prompt = imagePrompt.trim();
    if (!prompt) {
      showFeedback("Describe la imagen que quieres construir.", true);
      return;
    }

    const currentMemory = directionChanged ? saveDirection() : availableMemory;
    if (!currentMemory) return;

    const lifecycle = lifecycleRef.current;
    const controller = new AbortController();
    const startedAt = Date.now();
    imageAbortRef.current = controller;
    setImageElapsedSeconds(0);
    setImageLoading(true);
    showFeedback("");

    try {
      const outcome = await generateAndStoreImageAsset({
        intent: imageIntent,
        aspect: imageAspect,
        requestedTier,
        prompt,
        currentMemory,
        controller,
        lifecycle,
        onPreviewReady: () => {
          if (imageAbortRef.current === controller) {
            imageAbortRef.current = null;
          }
          setImageLoading(false);
          showFeedback(
            `${TIER_LABELS[requestedTier]} listo en ${formatElapsedTime(
              Math.max(1, Math.round((Date.now() - startedAt) / 1_000)),
            )}. Guardando en la biblioteca local…`,
          );
        },
      });

      showFeedback(
        outcome.persisted
          ? requestedTier === "ultra"
            ? "Render 4K experimental creado y guardado en la biblioteca local."
            : "Asset visual creado y guardado en la biblioteca local."
          : "Imagen creada solo para esta sesión. Descarga el original antes de cerrar.",
        !outcome.persisted,
      );
    } catch (error) {
      if (
        isActiveLifecycle(lifecycle) &&
        (error as Error).name !== "AbortError"
      ) {
        showFeedback(
          creativeFailureMessage(error, "No se pudo generar la imagen."),
          true,
        );
      }
    } finally {
      if (imageAbortRef.current === controller) imageAbortRef.current = null;
      if (isActiveLifecycle(lifecycle)) setImageLoading(false);
    }
  }

  function updateBrandKitItem(
    intent: CreativeImageIntent,
    update: Partial<BrandKitProgressItem>,
  ): void {
    setBrandKitProgress((current) =>
      current.map((item) =>
        item.intent === intent ? { ...item, ...update } : item,
      ),
    );
  }

  async function handleGenerateBrandKit(): Promise<void> {
    const availableMemory = memoryRef.current;
    if (
      !availableMemory ||
      !brief ||
      imageLoading ||
      brandKitLoading ||
      imageAbortRef.current
    ) {
      return;
    }
    if (brandKitRetryAt && brandKitRetryAt > Date.now()) {
      showFeedback(
        `El Brand Kit está protegido por un límite temporal. Reintento disponible en ${formatElapsedTime(
          Math.max(1, Math.ceil((brandKitRetryAt - Date.now()) / 1_000)),
        )}.`,
        true,
      );
      return;
    }
    if (!canGenerate) {
      showFeedback(
        "Completa nombre, audiencia y oferta antes de generar el Brand Kit.",
        true,
      );
      return;
    }

    const prompt =
      imagePrompt.trim() ||
      availableMemory.brief.visualDirection.trim() ||
      "Create a coherent premium visual identity system with one distinctive central idea.";
    const currentMemory = directionChanged ? saveDirection() : availableMemory;
    if (!currentMemory) return;

    const requestedTier: CreativeImageTier =
      imageTier === "ultra" ? "premium" : imageTier;
    const isResume =
      brandKitProgress.length === BRAND_KIT_ITEMS.length &&
      brandKitProgress.some((item) => !isBrandKitItemReady(item.status));
    const initialProgress: BrandKitProgressItem[] = isResume
      ? brandKitProgress.map((item) =>
          isBrandKitItemReady(item.status)
            ? item
            : {
                ...item,
                status: "pending",
                message: "Preparado para reintentar",
              },
        )
      : BRAND_KIT_ITEMS.map((item) => ({
          ...item,
          status: "pending",
        }));
    const operationId =
      (isResume && brandKitOperationIdRef.current) ||
      createBrandKitOperationId();
    brandKitOperationIdRef.current = operationId;
    const itemsToGenerate = BRAND_KIT_ITEMS.filter((item) => {
      const progressItem = initialProgress.find(
        (candidate) => candidate.intent === item.intent,
      );
      return !progressItem || !isBrandKitItemReady(progressItem.status);
    });
    const lifecycle = lifecycleRef.current;
    const controller = new AbortController();
    imageAbortRef.current = controller;
    setImageElapsedSeconds(0);
    setImageLoading(true);
    setBrandKitLoading(true);
    setBrandKitRetryAt(null);
    setBrandKitRetrySeconds(0);
    setBrandKitProgress(initialProgress);
    showFeedback("");

    let readyCount = initialProgress.filter((item) =>
      isBrandKitItemReady(item.status),
    ).length;
    let sessionOnlyCount = initialProgress.filter(
      (item) => item.status === "session-only",
    ).length;
    let errorCount = 0;
    let pausedRetryAfter = 0;

    try {
      for (const item of itemsToGenerate) {
        if (controller.signal.aborted) break;

        const kitPosition =
          BRAND_KIT_ITEMS.findIndex(
            (candidate) => candidate.intent === item.intent,
          ) + 1;
        updateBrandKitItem(item.intent, {
          status: "generating",
          message: `${kitPosition} de ${BRAND_KIT_ITEMS.length}`,
        });

        try {
          let automaticRetryUsed = false;
          let outcome: GeneratedAssetOutcome;

          while (true) {
            try {
              outcome = await generateAndStoreImageAsset({
                intent: item.intent,
                aspect: item.aspect,
                requestedTier,
                prompt,
                currentMemory,
                controller,
                lifecycle,
                operationId: `${operationId}-${item.intent}`,
              });
              break;
            } catch (error) {
              const retryAfter =
                error instanceof CreativeClientError &&
                error.code === "VAEORA_RATE_LIMITED"
                  ? Math.max(1, Math.ceil(error.retryAfter ?? 30))
                  : 0;

              if (
                retryAfter > 0 &&
                retryAfter <= MAX_BRAND_KIT_AUTO_RETRY_SECONDS &&
                !automaticRetryUsed
              ) {
                automaticRetryUsed = true;
                await waitForBrandKitRetry(
                  retryAfter,
                  controller.signal,
                  (remaining) => {
                    if (!isActiveLifecycle(lifecycle)) return;
                    updateBrandKitItem(item.intent, {
                      status: "generating",
                      message: `Reintentando automáticamente en ${formatElapsedTime(
                        remaining,
                      )}`,
                    });
                  },
                );
                updateBrandKitItem(item.intent, {
                  status: "generating",
                  message: "Reintentando ahora",
                });
                continue;
              }

              throw error;
            }
          }

          readyCount += 1;
          if (!outcome.persisted) sessionOnlyCount += 1;
          updateBrandKitItem(item.intent, {
            status: outcome.persisted ? "ready" : "session-only",
            assetId: outcome.metadata.id,
            message: outcome.persisted
              ? `${outcome.metadata.width} × ${outcome.metadata.height}`
              : "Descarga antes de cerrar",
          });
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            updateBrandKitItem(item.intent, {
              status: "cancelled",
              message: "Generación cancelada",
            });
            break;
          }

          if (
            error instanceof CreativeClientError &&
            error.code === "VAEORA_RATE_LIMITED"
          ) {
            pausedRetryAfter = Math.max(
              1,
              Math.ceil(error.retryAfter ?? 30),
            );
            setBrandKitRetrySeconds(pausedRetryAfter);
            setBrandKitRetryAt(Date.now() + pausedRetryAfter * 1_000);
            setBrandKitProgress((current) =>
              current.map((progressItem) =>
                progressItem.intent === item.intent ||
                progressItem.status === "pending"
                  ? {
                      ...progressItem,
                      status: "paused",
                      message: `Disponible en ${formatElapsedTime(
                        pausedRetryAfter,
                      )}`,
                    }
                  : progressItem,
              ),
            );
            break;
          }

          errorCount += 1;
          updateBrandKitItem(item.intent, {
            status: "error",
            message: creativeFailureMessage(
              error,
              "No se pudo generar este asset.",
            ),
          });
        }
      }

      if (!isActiveLifecycle(lifecycle)) return;

      if (controller.signal.aborted) {
        setBrandKitProgress((current) =>
          current.map((item) =>
            item.status === "pending"
              ? {
                  ...item,
                  status: "cancelled",
                  message: "No iniciado",
                }
              : item,
          ),
        );
        showFeedback(
          `Brand Kit cancelado. ${readyCount} asset${
            readyCount === 1 ? "" : "s"
          } preservado${readyCount === 1 ? "" : "s"}.`,
          true,
        );
      } else if (pausedRetryAfter > 0) {
        showFeedback(
          `Brand Kit pausado sin perder resultados. Reintento disponible en ${formatElapsedTime(
            pausedRetryAfter,
          )}; no se repetirán los assets ya guardados.`,
        );
      } else if (errorCount > 0) {
        showFeedback(
          `Brand Kit parcial: ${readyCount} de ${BRAND_KIT_ITEMS.length} assets listos. Los resultados creados quedaron preservados.`,
          true,
        );
      } else if (sessionOnlyCount > 0) {
        showFeedback(
          `Brand Kit completo: ${readyCount} assets creados; ${sessionOnlyCount} quedaron solo en esta sesión. Descárgalos antes de cerrar.`,
          true,
        );
      } else {
        showFeedback(
          `Brand Kit ${TIER_LABELS[requestedTier]} completo: ${readyCount} assets coordinados guardados en la biblioteca.`,
        );
      }
    } finally {
      if (imageAbortRef.current === controller) imageAbortRef.current = null;
      if (isActiveLifecycle(lifecycle)) {
        setImageLoading(false);
        setBrandKitLoading(false);
      }
    }
  }

  async function updateAssetStatus(
    view: AssetView,
    status: CreativeAssetMetadata["status"],
  ): Promise<void> {
    const currentMemory = memoryRef.current;
    if (
      !currentMemory ||
      assetStatusRequestsRef.current.has(view.metadata.id)
    ) {
      return;
    }

    const updatedMetadata: CreativeAssetMetadata = {
      ...view.metadata,
      status,
      updatedAt: new Date().toISOString(),
    };
    if (
      status === "approved" &&
      updatedMetadata.brandRevisionId !== currentMemory.brandRevisionId &&
      !window.confirm(
        "Este asset pertenece a una dirección anterior. ¿Quieres aprobarlo explícitamente para conservarlo como referencia?",
      )
    ) {
      return;
    }

    const lifecycle = lifecycleRef.current;
    assetStatusRequestsRef.current.add(view.metadata.id);
    setAssetBusyIds((current) => new Set(current).add(view.metadata.id));
    pendingPersistenceRef.current += 1;

    try {
      if (view.persisted) {
        await creativeAssetRepository.updateMetadata(updatedMetadata);
      } else if (view.blob) {
        await creativeAssetRepository.put(
          updatedMetadata,
          view.blob,
          view.thumbnail,
        );
      } else {
        throw new Error("The original asset is unavailable.");
      }

      if (!isActiveLifecycle(lifecycle)) return;

      const latestMemory = memoryRef.current ?? currentMemory;
      const existingMetadata = latestMemory.assets.some(
        (asset) => asset.id === updatedMetadata.id,
      );
      const nextMemory: CreativeStudioMemory = {
        ...latestMemory,
        assets: existingMetadata
          ? latestMemory.assets.map((asset) =>
              asset.id === updatedMetadata.id ? updatedMetadata : asset,
            )
          : [updatedMetadata, ...latestMemory.assets],
        updatedAt: updatedMetadata.updatedAt,
      };
      const updatedView: AssetView = {
        ...view,
        metadata: updatedMetadata,
        persisted: true,
      };
      const nextViews = assetViewsRef.current.map((asset) =>
        asset.metadata.id === updatedMetadata.id ? updatedView : asset,
      );
      assetViewsRef.current = nextViews;
      setAssetViews(nextViews);
      commitMemory(
        nextMemory,
        status === "approved"
          ? updatedMetadata.brandRevisionId === latestMemory.brandRevisionId
            ? "Asset aprobado y disponible para el contexto de Aura."
            : "Referencia anterior aprobada y preservada fuera de la dirección activa."
          : "Estado del asset actualizado.",
      );
    } catch {
      if (isActiveLifecycle(lifecycle)) {
        showFeedback(
          "No se pudo guardar el cambio. El estado anterior permanece intacto.",
          true,
        );
      }
    } finally {
      assetStatusRequestsRef.current.delete(view.metadata.id);
      pendingPersistenceRef.current = Math.max(
        0,
        pendingPersistenceRef.current - 1,
      );
      if (isActiveLifecycle(lifecycle)) {
        setAssetBusyIds((current) => {
          const next = new Set(current);
          next.delete(view.metadata.id);
          return next;
        });
      }
    }
  }

  function stageAssetAltText(assetId: string, value: string): void {
    const nextViews = assetViewsRef.current.map((asset) =>
      asset.metadata.id === assetId
        ? {
            ...asset,
            metadata: {
              ...asset.metadata,
              altText: value.slice(0, 160),
            },
          }
        : asset,
    );
    assetViewsRef.current = nextViews;
    setAssetViews(nextViews);
  }

  async function saveAssetAltText(assetId: string): Promise<void> {
    const view = assetViewsRef.current.find(
      (asset) => asset.metadata.id === assetId,
    );
    const currentMemory = memoryRef.current;

    if (
      !view ||
      !currentMemory ||
      assetStatusRequestsRef.current.has(assetId)
    ) {
      return;
    }

    const previous = currentMemory.assets.find((asset) => asset.id === assetId);
    const normalizedAlt = view.metadata.altText.trim().slice(0, 160);
    if (previous?.altText === normalizedAlt) return;

    const lifecycle = lifecycleRef.current;
    assetStatusRequestsRef.current.add(assetId);
    setAssetBusyIds((current) => new Set(current).add(assetId));
    pendingPersistenceRef.current += 1;
    const updatedMetadata: CreativeAssetMetadata = {
      ...view.metadata,
      altText: normalizedAlt,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (view.persisted) {
        await creativeAssetRepository.updateMetadata(updatedMetadata);
      } else if (view.blob) {
        await creativeAssetRepository.put(
          updatedMetadata,
          view.blob,
          view.thumbnail,
        );
      } else {
        throw new Error("The original asset is unavailable.");
      }

      if (!isActiveLifecycle(lifecycle)) return;
      const latestMemory = memoryRef.current ?? currentMemory;
      const exists = latestMemory.assets.some((asset) => asset.id === assetId);
      const nextMemory: CreativeStudioMemory = {
        ...latestMemory,
        assets: exists
          ? latestMemory.assets.map((asset) =>
              asset.id === assetId ? updatedMetadata : asset,
            )
          : [updatedMetadata, ...latestMemory.assets],
        updatedAt: updatedMetadata.updatedAt,
      };
      const nextViews = assetViewsRef.current.map((asset) =>
        asset.metadata.id === assetId
          ? { ...asset, metadata: updatedMetadata, persisted: true }
          : asset,
      );
      assetViewsRef.current = nextViews;
      setAssetViews(nextViews);
      commitMemory(nextMemory, "Texto alternativo guardado.");
    } catch {
      if (isActiveLifecycle(lifecycle)) {
        const nextViews = assetViewsRef.current.map((asset) =>
          asset.metadata.id === assetId && previous
            ? { ...asset, metadata: previous }
            : asset,
        );
        assetViewsRef.current = nextViews;
        setAssetViews(nextViews);
        showFeedback("No se pudo guardar el texto alternativo.", true);
      }
    } finally {
      assetStatusRequestsRef.current.delete(assetId);
      pendingPersistenceRef.current = Math.max(
        0,
        pendingPersistenceRef.current - 1,
      );
      if (isActiveLifecycle(lifecycle)) {
        setAssetBusyIds((current) => {
          const next = new Set(current);
          next.delete(assetId);
          return next;
        });
      }
    }
  }

  async function loadMoreAssets(): Promise<void> {
    if (libraryLoading || !hasMoreAssets) return;

    const lifecycle = lifecycleRef.current;
    setLibraryLoading(true);

    try {
      const page = await creativeAssetRepository.listPage(project.id, {
        limit: ASSET_PAGE_SIZE,
        cursor: assetPageCursorRef.current,
      });
      if (!isActiveLifecycle(lifecycle)) return;
      const existingIds = new Set(
        assetViewsRef.current.map((asset) => asset.metadata.id),
      );
      const loadedViews = page.assets
        .filter((asset) => !existingIds.has(asset.metadata.id))
        .map((asset) => createAssetView(asset, true));
      const mergedViews = [...assetViewsRef.current, ...loadedViews];
      assetViewsRef.current = mergedViews;
      assetPageCursorRef.current = page.nextCursor;
      setAssetViews(mergedViews);
      setHasMoreAssets(page.hasMore);
    } catch {
      if (isActiveLifecycle(lifecycle)) {
        showFeedback("No se pudieron cargar más assets locales.", true);
      }
    } finally {
      if (isActiveLifecycle(lifecycle)) setLibraryLoading(false);
    }
  }

  async function downloadAsset(view: AssetView): Promise<void> {
    if (assetDownloadRequestsRef.current.has(view.metadata.id)) return;

    const lifecycle = lifecycleRef.current;
    let blob = view.blob;
    assetDownloadRequestsRef.current.add(view.metadata.id);
    setAssetDownloadIds((current) => new Set(current).add(view.metadata.id));

    try {
      if (!blob && view.persisted) {
        showFeedback("Preparando el original local…");
        blob = (await creativeAssetRepository.get(view.metadata.id))?.blob;
      }

      if (!blob || !isActiveLifecycle(lifecycle)) {
        if (isActiveLifecycle(lifecycle)) {
          showFeedback("El original ya no está disponible en esta sesión.", true);
        }
        return;
      }

      const originalUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = originalUrl;
      anchor.download = `${cleanFileName(
        `${brief?.brandName ?? project.name}-${view.metadata.title}`,
      )}.${assetExtension(view.metadata.mimeType)}`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(originalUrl), 1_000);
      showFeedback("Descarga preparada.");
    } catch {
      if (isActiveLifecycle(lifecycle)) {
        showFeedback("No se pudo recuperar el original local.", true);
      }
    } finally {
      assetDownloadRequestsRef.current.delete(view.metadata.id);
      if (isActiveLifecycle(lifecycle)) {
        setAssetDownloadIds((current) => {
          const next = new Set(current);
          next.delete(view.metadata.id);
          return next;
        });
      }
    }
  }

  function cancelActiveGeneration(): void {
    copyAbortRef.current?.abort();
    imageAbortRef.current?.abort();
    showFeedback("Generación cancelada.");
  }

  async function requestPersistentStorage(): Promise<void> {
    if (storageChecking) return;

    const lifecycle = lifecycleRef.current;
    setStorageChecking(true);

    try {
      if (!navigator.storage?.estimate) {
        throw new Error("Storage management unavailable");
      }

      const persistent = navigator.storage.persist
        ? await navigator.storage.persist()
        : false;
      const estimate = await navigator.storage.estimate();

      if (!isActiveLifecycle(lifecycle)) return;
      const usage = formatStorageBytes(estimate.usage ?? 0);
      const quota = formatStorageBytes(estimate.quota ?? 0);
      setStorageSummary(
        `${usage} usados de ${quota}${persistent ? " · almacenamiento protegido" : " · el navegador puede liberar espacio"}`,
      );
      showFeedback(
        persistent
          ? "El navegador protegerá mejor esta biblioteca local."
          : "La biblioteca sigue disponible, pero conviene descargar los originales importantes.",
        !persistent,
      );
    } catch {
      if (isActiveLifecycle(lifecycle)) {
        showFeedback(
          "Este navegador no permite comprobar o proteger el almacenamiento local.",
          true,
        );
      }
    } finally {
      if (isActiveLifecycle(lifecycle)) setStorageChecking(false);
    }
  }

  async function deleteAsset(view: AssetView): Promise<void> {
    if (
      assetStatusRequestsRef.current.has(view.metadata.id) ||
      !window.confirm(
        `Eliminar “${view.metadata.title}” de esta biblioteca local? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    const lifecycle = lifecycleRef.current;
    assetStatusRequestsRef.current.add(view.metadata.id);
    setAssetBusyIds((current) => new Set(current).add(view.metadata.id));
    pendingPersistenceRef.current += 1;

    try {
      if (view.persisted) {
        await creativeAssetRepository.delete(view.metadata.id);
      }
      if (!isActiveLifecycle(lifecycle)) return;

      const remainingViews = assetViewsRef.current.filter(
        (asset) => asset.metadata.id !== view.metadata.id,
      );
      revokeAssetView(view);
      assetViewsRef.current = remainingViews;
      setAssetViews(remainingViews);
      setActiveAssetId((current) =>
        current === view.metadata.id
          ? remainingViews[0]?.metadata.id ?? null
          : current,
      );

      const currentMemory = memoryRef.current;
      if (currentMemory && view.persisted) {
        commitMemory(
          {
            ...currentMemory,
            assets: currentMemory.assets.filter(
              (asset) => asset.id !== view.metadata.id,
            ),
            updatedAt: new Date().toISOString(),
          },
          "Asset eliminado de esta biblioteca local.",
        );
      } else {
        showFeedback("Asset de sesión descartado.");
      }
    } catch {
      if (isActiveLifecycle(lifecycle)) {
        showFeedback("No se pudo eliminar el asset local.", true);
      }
    } finally {
      assetStatusRequestsRef.current.delete(view.metadata.id);
      pendingPersistenceRef.current = Math.max(
        0,
        pendingPersistenceRef.current - 1,
      );
      if (isActiveLifecycle(lifecycle)) {
        setAssetBusyIds((current) => {
          const next = new Set(current);
          next.delete(view.metadata.id);
          return next;
        });
      }
    }
  }

  function restoreOutputVersion(
    deliverable: CreativeCopyDeliverable,
    generatedAt: string,
  ): void {
    const currentMemory = memoryRef.current;
    const version = currentMemory?.outputHistory[deliverable]?.find(
      (candidate) => candidate.generatedAt === generatedAt,
    );

    if (!currentMemory || !version) return;

    commitMemory(
      {
        ...currentMemory,
        outputs: {
          ...currentMemory.outputs,
          [deliverable]: version,
        },
        updatedAt: new Date().toISOString(),
      },
      "Versión restaurada como resultado activo. El historial sigue intacto.",
    );
  }

  function saveEditedOutputVersion(
    deliverable: CreativeCopyDeliverable,
    data: unknown,
  ): boolean {
    const currentMemory = memoryRef.current;
    const activeOutput = currentMemory?.outputs[deliverable];

    if (!currentMemory || !activeOutput) return false;

    const validated = validateCreativeCopyContent(deliverable, data);
    if (!validated.success) {
      showFeedback(
        "La edición aún no cumple la estructura requerida para este sistema.",
        true,
      );
      return false;
    }

    const generatedAt = new Date().toISOString();
    const editedVersion = {
      ...activeOutput,
      data: validated.data,
      model: `${activeOutput.model} · edited`,
      brandRevisionId: currentMemory.brandRevisionId,
      generatedAt,
    };
    const nextMemory: CreativeStudioMemory = {
      ...currentMemory,
      outputs: {
        ...currentMemory.outputs,
        [deliverable]: editedVersion,
      },
      outputHistory: {
        ...currentMemory.outputHistory,
        [deliverable]: [
          editedVersion,
          ...(currentMemory.outputHistory[deliverable] ?? []),
        ].slice(0, MAX_OUTPUT_VERSIONS),
      },
      updatedAt: generatedAt,
    };

    commitMemory(
      nextMemory,
      "Edición guardada como una nueva versión dentro de la revisión activa.",
    );
    return true;
  }

  function restoreBriefRevision(revisionId: string): void {
    const currentMemory = memoryRef.current;
    const revision = currentMemory?.briefHistory.find(
      (candidate) => candidate.id === revisionId,
    );

    if (!currentMemory || !revision || revisionId === currentMemory.brandRevisionId) {
      return;
    }

    const restored = reviseCreativeBrief(currentMemory, revision.brief);
    setBrief(restored.brief);
    commitMemory(
      restored,
      "Dirección anterior restaurada como una nueva revisión. Nada fue eliminado.",
    );
  }

  function renderBriefHistory(currentMemory: CreativeStudioMemory) {
    if (currentMemory.briefHistory.length < 2) return null;

    return (
      <details className={styles.versionHistory}>
        <summary>
          {currentMemory.briefHistory.length} direcciones locales · límite 20
        </summary>
        <div className={styles.versionList}>
          {currentMemory.briefHistory.map((revision, index) => (
            <button
              key={revision.id}
              type="button"
              className={styles.versionButton}
              data-active={
                revision.id === currentMemory.brandRevisionId ? "true" : "false"
              }
              aria-pressed={revision.id === currentMemory.brandRevisionId}
              onClick={() => restoreBriefRevision(revision.id)}
            >
              <strong>Direction V{currentMemory.briefHistory.length - index}</strong>
              <span>{formatDate(revision.createdAt)}</span>
              <span>REV {revision.id.slice(0, 8).toUpperCase()}</span>
            </button>
          ))}
        </div>
      </details>
    );
  }

  function renderOutputRevisionSignal(
    output: CreativeStudioMemory["outputs"][CreativeCopyDeliverable],
    currentMemory: CreativeStudioMemory,
  ) {
    if (
      !output ||
      output.brandRevisionId === currentMemory.brandRevisionId
    ) {
      return null;
    }

    return (
      <p className={styles.staleNotice} role="status">
        Este resultado pertenece a REV {output.brandRevisionId.slice(0, 8).toUpperCase()}.
        Se conserva como referencia; regenera para conectarlo a la dirección activa.
      </p>
    );
  }

  function renderOutputHistory(
    deliverable: CreativeCopyDeliverable,
    currentMemory: CreativeStudioMemory,
  ) {
    const versions = currentMemory.outputHistory[deliverable] ?? [];
    if (versions.length < 2) return null;

    const activeGeneratedAt = currentMemory.outputs[deliverable]?.generatedAt;

    return (
      <details className={styles.versionHistory}>
        <summary>{versions.length} versiones preservadas</summary>
        <div className={styles.versionList}>
          {versions.map((version, index) => (
            <button
              key={`${version.generatedAt}-${index}`}
              type="button"
              className={styles.versionButton}
              data-active={
                activeGeneratedAt === version.generatedAt ? "true" : "false"
              }
              aria-pressed={activeGeneratedAt === version.generatedAt}
              onClick={() =>
                restoreOutputVersion(deliverable, version.generatedAt)
              }
            >
              <strong>V{versions.length - index}</strong>
              <span>{formatDate(version.generatedAt)}</span>
              <span>REV {version.brandRevisionId.slice(0, 8).toUpperCase()}</span>
            </button>
          ))}
        </div>
      </details>
    );
  }

  function renderAreaHeader(
    title: string,
    description: string,
  ) {
    return (
      <header className={styles.areaHeader}>
        <div>
          <p className={styles.eyebrow}>
            {currentArea.index} / {currentArea.label}
          </p>
          <h2>{title}</h2>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} aria-hidden="true" />
          {directionChanged ? "Unsaved direction" : "Memory synchronized"}
        </div>
      </header>
    );
  }

  if (!memory || !brief) {
    return renderStudio(
      <section
        ref={studioRef}
        className={styles.studio}
        role="dialog"
        aria-modal="true"
        aria-label="Cargando Creative Studio"
      >
        <div className={styles.loading}>Manifesting Creative Studio…</div>
      </section>,
    );
  }

  const foundation = memory.outputs["brand-foundation"];
  const website = memory.outputs["website-copy"];
  const social = memory.outputs["social-kit"];

  return renderStudio(
    <section
      ref={studioRef}
      className={styles.studio}
      role="dialog"
      aria-modal="true"
      aria-labelledby="creative-studio-title"
      aria-busy={Boolean(copyLoading || imageLoading)}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brandLockup}>
            <p>VAEORA / CREATIVE INTELLIGENCE</p>
            <h1 id="creative-studio-title">{brief.brandName || project.name}</h1>
          </div>

          <div className={styles.headerMeta}>
            <span>Local-first studio</span>
            <span className={styles.revision} title={memory.brandRevisionId}>
              REV {memory.brandRevisionId.slice(0, 8).toUpperCase()}
            </span>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={requestClose}
            aria-label="Cerrar Creative Studio"
            title="Cerrar Creative Studio"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.workspace}>
          <aside className={styles.rail}>
            <p className={styles.railTitle}>Creative system</p>
            <nav className={styles.nav} aria-label="Áreas de Creative Studio">
              {AREAS.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  className={styles.navButton}
                  data-active={area === definition.id ? "true" : "false"}
                  onClick={() => requestAreaChange(definition.id)}
                  aria-pressed={area === definition.id}
                  aria-current={area === definition.id ? "page" : undefined}
                >
                  <span className={styles.navIcon} aria-hidden="true">
                    {definition.index}
                  </span>
                  <span className={styles.navLabel}>
                    <strong>{definition.label}</strong>
                    <span>{definition.description}</span>
                  </span>
                </button>
              ))}
            </nav>

            {(copyLoading || imageLoading) && (
              <div
                className={styles.generationSignal}
                role="status"
                aria-live="polite"
              >
                <span aria-hidden="true" className={styles.statusDot} />
                <span>
                  {imageLoading
                    ? `${imageFormationPhase(
                        imageElapsedSeconds,
                      )} · ${formatElapsedTime(imageElapsedSeconds)}`
                    : "Construyendo sistema"}
                </span>
                <button type="button" onClick={cancelActiveGeneration}>
                  Cancelar
                </button>
              </div>
            )}

            {memory.legacyImport && (
              <p className={styles.legacySignal}>
                Legacy memory preserved · {Object.keys(
                  memory.legacyImport.brandingContent,
                ).length} branding sections
              </p>
            )}
          </aside>

          <div className={styles.main}>
            {area === "direction" && (
              <>
                {renderAreaHeader(
                  "Define the signal.",
                  "Una dirección de marca única alimenta cada logo, imagen, texto web y campaña. Cuando cambia, VAEORA conserva las versiones anteriores y abre una nueva revisión.",
                )}

                <div className={styles.panel}>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span>Nombre de marca</span>
                      <input
                        value={brief.brandName}
                        onChange={(event) =>
                          setBrief({ ...brief, brandName: event.target.value })
                        }
                        maxLength={80}
                        autoComplete="organization"
                        placeholder="VAEORA"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Idioma de salida</span>
                      <select
                        value={brief.locale}
                        onChange={(event) =>
                          setBrief({
                            ...brief,
                            locale: event.target.value as CreativeBrandBrief["locale"],
                          })
                        }
                      >
                        <option value="es">Español</option>
                        <option value="en">English</option>
                        <option value="pt">Português (Brasil)</option>
                        <option value="fr">Français</option>
                      </select>
                    </label>

                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span>Audiencia</span>
                      <textarea
                        value={brief.audience}
                        onChange={(event) =>
                          setBrief({ ...brief, audience: event.target.value })
                        }
                        maxLength={600}
                        placeholder="¿Para quién existe esta marca y qué reconoce esa persona como valioso?"
                      />
                    </label>

                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span>Oferta y transformación</span>
                      <textarea
                        value={brief.offer}
                        onChange={(event) =>
                          setBrief({ ...brief, offer: event.target.value })
                        }
                        maxLength={1200}
                        placeholder="Qué ofrece, qué problema transforma y por qué importa."
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Personalidad</span>
                      <textarea
                        value={brief.personality}
                        onChange={(event) =>
                          setBrief({ ...brief, personality: event.target.value })
                        }
                        maxLength={300}
                        placeholder="Premium, inteligente, orgánica, serena…"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Dirección visual</span>
                      <textarea
                        value={brief.visualDirection}
                        onChange={(event) =>
                          setBrief({
                            ...brief,
                            visualDirection: event.target.value,
                          })
                        }
                        maxLength={1500}
                        placeholder="Luz, materia, composición, fotografía, ritmo, referencias conceptuales…"
                      />
                    </label>

                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span>Restricciones y elementos a evitar</span>
                      <textarea
                        value={brief.constraints}
                        onChange={(event) =>
                          setBrief({ ...brief, constraints: event.target.value })
                        }
                        maxLength={1200}
                        placeholder="Clichés, colores, símbolos, claims o estilos que no deben aparecer."
                      />
                    </label>
                  </div>

                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={saveDirection}
                      disabled={!directionChanged}
                    >
                      Guardar dirección
                    </button>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      onClick={() => handleGenerateCopy("brand-foundation")}
                      disabled={Boolean(copyLoading) || !canGenerate}
                      aria-busy={copyLoading === "brand-foundation"}
                      data-state={
                        copyLoading === "brand-foundation"
                          ? "loading"
                          : "idle"
                      }
                    >
                      {copyLoading === "brand-foundation"
                        ? "Organizando la marca…"
                        : "Generar Brand Foundation"}
                    </button>
                  </div>

                  {renderBriefHistory(memory)}

                  {foundation && (
                    <>
                      {renderOutputRevisionSignal(foundation, memory)}
                      {renderOutputHistory("brand-foundation", memory)}
                      <StructuredCreativeOutput
                        data={foundation.data}
                        fileName={`${cleanFileName(brief.brandName)}-brand-foundation`}
                        onFeedback={showFeedback}
                        onSaveVersion={(data) =>
                          saveEditedOutputVersion("brand-foundation", data)
                        }
                        onDirtyChange={(dirty) => {
                          outputEditorDirtyRef.current = dirty;
                        }}
                      />
                    </>
                  )}
                </div>
              </>
            )}

            {area === "image" && (
              <>
                {renderAreaHeader(
                  "Make it visible.",
                  "Genera conceptos de logo, fotografía, hero images, producto, texturas y piezas sociales dentro de la misma revisión de marca.",
                )}

                <div className={`${styles.panel} ${styles.generatorGrid}`}>
                  <section className={styles.controlPanel}>
                    <h3 className={styles.panelTitle}>Visual brief</h3>

                    <div className={styles.presetGrid}>
                      {IMAGE_INTENTS.map((intent) => (
                        <button
                          key={intent.id}
                          type="button"
                          className={styles.presetButton}
                          data-active={imageIntent === intent.id ? "true" : "false"}
                          aria-pressed={imageIntent === intent.id}
                          onClick={() => selectIntent(intent.id)}
                        >
                          <strong>{intent.label}</strong>
                          <span>{intent.description}</span>
                        </button>
                      ))}
                    </div>

                    <label className={`${styles.field} ${styles.panel}`}>
                      <span>Qué debe tomar forma</span>
                      <textarea
                        value={imagePrompt}
                        onChange={(event) => setImagePrompt(event.target.value)}
                        maxLength={2400}
                        placeholder={
                          imageIntent === "logo-mark"
                            ? "Un símbolo abstracto y asimétrico que exprese inteligencia orgánica; sin texto ni mockup."
                            : "Describe sujeto, composición, luz, materialidad y emoción."
                        }
                      />
                    </label>

                    <p className={styles.panelTitle}>Formato</p>
                    <div className={styles.presetGrid}>
                      {ASPECTS.map((aspect) => (
                        <button
                          key={aspect.id}
                          type="button"
                          className={styles.presetButton}
                          data-active={imageAspect === aspect.id ? "true" : "false"}
                          aria-pressed={imageAspect === aspect.id}
                          disabled={
                            imageIntent === "logo-mark" && aspect.id !== "square"
                          }
                          onClick={() => {
                            setImageAspect(aspect.id);
                            if (
                              imageTier === "ultra" &&
                              aspect.id !== "landscape" &&
                              aspect.id !== "hero"
                            ) {
                              setImageTier("premium");
                            }
                          }}
                        >
                          <strong>{aspect.label}</strong>
                          <span>{aspect.description}</span>
                        </button>
                      ))}
                    </div>

                    <p className={`${styles.panelTitle} ${styles.panel}`}>Calidad</p>
                    <div className={styles.presetGrid}>
                      {TIERS.map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          className={styles.presetButton}
                          data-active={imageTier === tier.id ? "true" : "false"}
                          aria-pressed={imageTier === tier.id}
                          disabled={
                            tier.id === "ultra" &&
                            imageAspect !== "landscape" &&
                            imageAspect !== "hero"
                          }
                          onClick={() => setImageTier(tier.id)}
                        >
                          <strong>{tier.label}</strong>
                          <span>{tier.description}</span>
                        </button>
                      ))}
                    </div>

                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() => void handleGenerateImage()}
                        disabled={imageLoading || !imagePrompt.trim() || !canGenerate}
                        aria-busy={imageLoading}
                        data-state={imageLoading ? "loading" : "idle"}
                      >
                        {imageLoading
                          ? `${imageFormationPhase(
                              imageElapsedSeconds,
                            )} · ${formatElapsedTime(imageElapsedSeconds)}`
                          : imageTier === "draft"
                            ? "Generar vista previa"
                            : imageTier === "ultra"
                              ? "Generar final 4K"
                              : "Generar asset Studio"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={() => void handleGenerateBrandKit()}
                        disabled={
                          imageLoading ||
                          brandKitLoading ||
                          brandKitRetrySeconds > 0 ||
                          !canGenerate
                        }
                        aria-busy={brandKitLoading}
                        data-state={
                          brandKitLoading
                            ? "loading"
                            : brandKitRetrySeconds > 0
                              ? "paused"
                              : incompleteBrandKitCount > 0
                                ? "ready"
                                : "idle"
                        }
                      >
                        {brandKitLoading
                          ? `Brand Kit · ${completedBrandKitCount}/${BRAND_KIT_ITEMS.length}`
                          : brandKitRetrySeconds > 0
                            ? `Reintentar en ${formatElapsedTime(
                                brandKitRetrySeconds,
                              )}`
                            : incompleteBrandKitCount > 0
                              ? `Reintentar ${incompleteBrandKitCount} asset${
                                  incompleteBrandKitCount === 1 ? "" : "s"
                                } pendiente${
                                  incompleteBrandKitCount === 1 ? "" : "s"
                                }`
                              : brandKitProgress.length > 0
                                ? `Generar nueva versión · ${BRAND_KIT_ITEMS.length} assets`
                                : `Generar Brand Kit · ${BRAND_KIT_ITEMS.length} assets`}
                      </button>
                      <button
                        type="button"
                        className={styles.quietAction}
                        onClick={() => void handleGenerateCopy("social-kit")}
                        disabled={Boolean(copyLoading) || !canGenerate}
                        aria-busy={copyLoading === "social-kit"}
                        data-state={
                          copyLoading === "social-kit" ? "loading" : "idle"
                        }
                      >
                        {copyLoading === "social-kit"
                          ? "Creando copy…"
                          : social
                            ? "Actualizar captions y posts"
                            : "Crear captions y posts"}
                      </button>
                    </div>

                    {brandKitProgress.length > 0 && (
                      <section
                        className={styles.brandKitProgress}
                        aria-label="Progreso del Brand Kit"
                        aria-live="polite"
                      >
                        <div className={styles.brandKitHeader}>
                          <strong>Visual system</strong>
                          <span>
                            {completedBrandKitCount} de {BRAND_KIT_ITEMS.length}{" "}
                            listos
                          </span>
                        </div>
                        <div className={styles.brandKitGrid}>
                          {brandKitProgress.map((item) => {
                            const itemMessage =
                              item.status === "paused" &&
                              brandKitRetrySeconds > 0
                                ? `Disponible en ${formatElapsedTime(
                                    brandKitRetrySeconds,
                                  )}`
                                : item.message;

                            return (
                              <div
                                key={item.intent}
                                className={styles.brandKitItem}
                                data-state={item.status}
                              >
                                <span
                                  className={styles.brandKitMark}
                                  aria-hidden="true"
                                >
                                  {BRAND_KIT_STATUS_MARKS[item.status]}
                                </span>
                                <span className={styles.brandKitLabel}>
                                  <strong>{item.label}</strong>
                                  <small>
                                    {BRAND_KIT_STATUS_LABELS[item.status]}
                                    {itemMessage ? ` · ${itemMessage}` : ""}
                                  </small>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    <p className={styles.finePrint}>
                      Empieza con Explore para decidir rápido y lleva únicamente la
                      dirección elegida a Studio o Ultra. Ultra 4K es experimental y puede
                      tardar hasta dos minutos. Hero entrega 16:9 nativo; Ultra entrega
                      3840 × 2160. Los logos generados son conceptos raster; la tipografía y
                      vector final deben aprobarse como sistema de marca. El Brand Kit
                      genera seis assets coordinados en Explore o Studio; Ultra se reserva
                      para finalizar individualmente la dirección aprobada.
                    </p>
                  </section>

                  <section className={styles.previewPanel} aria-live="polite">
                    <h3 className={styles.panelTitle}>Latest formation</h3>
                    {imageLoading && (
                      <div
                        className={`${styles.formationProgress} ${
                          activeAsset ? styles.formationProgressCompact : ""
                        }`}
                        aria-hidden="true"
                      >
                        <span className={styles.formationGlow} />
                        <div>
                          <span>
                            {brandKitLoading
                              ? `Brand Kit · ${Math.min(
                                  BRAND_KIT_ITEMS.length,
                                  completedBrandKitCount + 1,
                                )}/${BRAND_KIT_ITEMS.length}`
                              : TIER_LABELS[imageTier]}
                          </span>
                          <strong>
                            {brandKitLoading
                              ? "Formando un sistema visual coordinado"
                              : imageFormationPhase(imageElapsedSeconds)}
                          </strong>
                          <small>
                            {formatElapsedTime(imageElapsedSeconds)} · puedes
                            cancelar sin abandonar el estudio
                          </small>
                        </div>
                      </div>
                    )}
                    {activeAsset ? (
                      <>
                        <div className={styles.assetPreview}>
                          {activeAssetPreviewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={activeAssetPreviewUrl}
                              alt={activeAsset.metadata.altText}
                              decoding="async"
                            />
                          ) : (
                            <div className={styles.previewPlaceholder} role="status">
                              Preparando vista previa…
                            </div>
                          )}
                          <div className={styles.assetMeta}>
                            <span>{activeAsset.metadata.title}</span>
                            <span>
                              {activeAsset.metadata.width} × {activeAsset.metadata.height}
                              {activeAsset.metadata.width >= 3840 ? " · 4K" : ""}
                            </span>
                          </div>
                        </div>
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className={styles.secondaryAction}
                            onClick={() => downloadAsset(activeAsset)}
                            disabled={assetDownloadIds.has(
                              activeAsset.metadata.id,
                            )}
                            aria-busy={assetDownloadIds.has(
                              activeAsset.metadata.id,
                            )}
                          >
                            {assetDownloadIds.has(activeAsset.metadata.id)
                              ? "Preparando…"
                              : "Guardar archivo original"}
                          </button>
                          <button
                            type="button"
                            className={styles.quietAction}
                            onClick={() => requestAreaChange("library")}
                          >
                            Abrir biblioteca
                          </button>
                          <button
                            type="button"
                            className={`${styles.quietAction} ${styles.dangerAction}`}
                            aria-label={`Eliminar concepto ${activeAsset.metadata.title}`}
                            onClick={() => deleteAsset(activeAsset)}
                            disabled={assetBusyIds.has(activeAsset.metadata.id)}
                            aria-busy={assetBusyIds.has(activeAsset.metadata.id)}
                            data-state={
                              assetBusyIds.has(activeAsset.metadata.id)
                                ? "loading"
                                : "idle"
                            }
                          >
                            {assetBusyIds.has(activeAsset.metadata.id)
                              ? "Eliminando…"
                              : "Eliminar concepto"}
                          </button>
                        </div>
                      </>
                    ) : !imageLoading ? (
                      <div className={styles.previewEmpty}>
                        <div>
                          <strong>No hay un asset todavía.</strong>
                          <span>
                            La primera generación aparecerá aquí sin abandonar el estudio.
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>

                {social && (
                  <>
                    {renderOutputRevisionSignal(social, memory)}
                    {renderOutputHistory("social-kit", memory)}
                    <StructuredCreativeOutput
                      data={social.data}
                      fileName={`${cleanFileName(brief.brandName)}-social-kit`}
                      onFeedback={showFeedback}
                      onSaveVersion={(data) =>
                        saveEditedOutputVersion("social-kit", data)
                      }
                      onDirtyChange={(dirty) => {
                        outputEditorDirtyRef.current = dirty;
                      }}
                    />
                  </>
                )}
              </>
            )}

            {area === "website" && (
              <>
                {renderAreaHeader(
                  "Build the presence.",
                  "VAEORA convierte la dirección de marca en SEO, hero, navegación narrativa, secciones, mensajes y llamadas a la acción listos para editar y exportar.",
                )}

                <div className={styles.panel}>
                  <section className={styles.controlPanel}>
                    <h3 className={styles.panelTitle}>Website content system</h3>
                    <p className={styles.description}>
                      La generación utiliza únicamente el contexto de este proyecto y la
                      revisión de marca activa. Nada se publica automáticamente.
                    </p>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() => handleGenerateCopy("website-copy")}
                        disabled={Boolean(copyLoading) || !canGenerate}
                        aria-busy={copyLoading === "website-copy"}
                        data-state={
                          copyLoading === "website-copy" ? "loading" : "idle"
                        }
                      >
                        {copyLoading === "website-copy"
                          ? "Construyendo la presencia…"
                          : website
                            ? "Generar nueva versión"
                            : "Generar Website Kit"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={() => requestAreaChange("direction")}
                      >
                        Revisar dirección
                      </button>
                    </div>
                  </section>

                  {website ? (
                    <>
                      {renderOutputRevisionSignal(website, memory)}
                      {renderOutputHistory("website-copy", memory)}
                      <StructuredCreativeOutput
                        data={website.data}
                        fileName={`${cleanFileName(brief.brandName)}-website-kit`}
                        onFeedback={showFeedback}
                        onSaveVersion={(data) =>
                          saveEditedOutputVersion("website-copy", data)
                        }
                        onDirtyChange={(dirty) => {
                          outputEditorDirtyRef.current = dirty;
                        }}
                      />
                    </>
                  ) : (
                    <div className={styles.previewEmpty}>
                      <div>
                        <strong>La arquitectura verbal espera una señal.</strong>
                        <span>
                          Completa Direction y genera el primer sistema de contenido web.
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}

            {area === "library" && (
              <>
                {renderAreaHeader(
                  "Keep every evolution visible.",
                  "Hasta 200 referencias locales conservan prompt, procedencia, calidad y revisión de marca. Aprobar una la hace visible para la memoria contextual de Aura.",
                )}

                <div className={styles.panel}>
                  <div className={styles.libraryToolbar}>
                    <p className={styles.finePrint}>
                      Biblioteca v1 local: los originales viven en este navegador y
                      dirección web. Descárgalos para moverlos entre computadora,
                      localhost y teléfono.
                      {storageSummary ? ` ${storageSummary}.` : ""}
                    </p>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={requestPersistentStorage}
                      disabled={storageChecking}
                      aria-busy={storageChecking}
                    >
                      {storageChecking
                        ? "Comprobando…"
                        : "Proteger biblioteca local"}
                    </button>
                  </div>
                  {assetViews.length > 0 ? (
                    <div className={styles.libraryGrid}>
                      {assetViews.map((view) => {
                        const stale =
                          view.metadata.brandRevisionId !== memory.brandRevisionId;

                        return (
                          <article
                            key={view.metadata.id}
                            className={styles.assetCard}
                            data-stale={stale ? "true" : "false"}
                            aria-busy={assetBusyIds.has(view.metadata.id)}
                          >
                            <div className={styles.assetImage}>
                              {view.thumbnailUrl ?? view.originalUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={view.thumbnailUrl ?? view.originalUrl}
                                  alt={view.metadata.altText}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className={styles.previewPlaceholder}>
                                  Vista previa bajo demanda
                                </div>
                              )}
                              <div className={styles.assetBadges}>
                                <span className={styles.assetBadge}>
                                  {view.persisted
                                    ? view.metadata.status
                                    : "Session only"}
                                </span>
                                {stale && (
                                  <span className={styles.assetBadge}>
                                    Previous direction
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={styles.assetBody}>
                              <h3>{view.metadata.title}</h3>
                              <p>
                                {view.metadata.width} × {view.metadata.height} ·{" "}
                                {formatDate(view.metadata.createdAt)}
                              </p>
                              <label className={styles.assetAltField}>
                                <span>Texto alternativo</span>
                                <input
                                  value={view.metadata.altText}
                                  maxLength={160}
                                  placeholder={
                                    view.metadata.kind === "brand-texture"
                                      ? "Vacío si la textura es decorativa"
                                      : "Describe brevemente el contenido visual"
                                  }
                                  onChange={(event) =>
                                    stageAssetAltText(
                                      view.metadata.id,
                                      event.target.value,
                                    )
                                  }
                                  onBlur={() =>
                                    saveAssetAltText(view.metadata.id)
                                  }
                                  disabled={assetBusyIds.has(view.metadata.id)}
                                />
                              </label>
                              <div className={styles.assetActions}>
                                <button
                                  type="button"
                                  aria-label={"Ver " + view.metadata.title}
                                  onClick={() => {
                                    setActiveAssetId(view.metadata.id);
                                    requestAreaChange("image");
                                  }}
                                  disabled={assetBusyIds.has(view.metadata.id)}
                                >
                                  Ver
                                </button>
                                <button
                                  type="button"
                                  aria-label={"Descargar " + view.metadata.title}
                                  onClick={() => downloadAsset(view)}
                                  disabled={
                                    assetBusyIds.has(view.metadata.id) ||
                                    assetDownloadIds.has(view.metadata.id)
                                  }
                                  aria-busy={assetDownloadIds.has(
                                    view.metadata.id,
                                  )}
                                >
                                  {assetDownloadIds.has(view.metadata.id)
                                    ? "Preparando…"
                                    : "Descargar"}
                                </button>
                                <button
                                  type="button"
                                  aria-label={"Seleccionar " + view.metadata.title}
                                  onClick={() =>
                                    updateAssetStatus(view, "selected")
                                  }
                                  disabled={assetBusyIds.has(view.metadata.id)}
                                >
                                  {assetBusyIds.has(view.metadata.id)
                                    ? "Guardando…"
                                    : "Seleccionar"}
                                </button>
                                <button
                                  type="button"
                                  aria-label={
                                    (view.metadata.status === "approved"
                                      ? "Reabrir "
                                      : "Aprobar ") + view.metadata.title
                                  }
                                  onClick={() =>
                                    updateAssetStatus(
                                      view,
                                      view.metadata.status === "approved"
                                        ? "draft"
                                        : "approved",
                                    )
                                  }
                                  disabled={assetBusyIds.has(view.metadata.id)}
                                >
                                  {view.metadata.status === "approved"
                                    ? "Reabrir"
                                    : "Aprobar"}
                                </button>
                                <button
                                  type="button"
                                  className={styles.dangerAction}
                                  aria-label={
                                    "Eliminar localmente " + view.metadata.title
                                  }
                                  onClick={() => deleteAsset(view)}
                                  disabled={assetBusyIds.has(view.metadata.id)}
                                >
                                  Eliminar local
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.previewEmpty}>
                      <div>
                        <strong>La biblioteca está vacía.</strong>
                        <span>
                          Abre Image Lab para crear el primer concepto visual del proyecto.
                        </span>
                      </div>
                    </div>
                  )}

                  {(hasMoreAssets || libraryLoading) && (
                    <div className={styles.libraryMore}>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={loadMoreAssets}
                        disabled={libraryLoading || !hasMoreAssets}
                        aria-busy={libraryLoading}
                        data-state={libraryLoading ? "loading" : "idle"}
                      >
                        {libraryLoading ? "Cargando…" : "Cargar más assets"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {feedback.message && (
          <p
            className={styles.feedback}
            data-error={feedback.error ? "true" : "false"}
            role={feedback.error ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </section>,
  );
}
