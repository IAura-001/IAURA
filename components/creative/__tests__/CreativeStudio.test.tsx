import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { CreativeStudioMemory } from "@/types/creative-studio";
import type { IAuraProject } from "@/types/project";

const projectEngineMock = vi.hoisted(() => ({
  updateCreativeStudio: vi.fn(),
}));

const creativeApiMock = vi.hoisted(() => {
  class CreativeClientError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly requestId?: string;
    readonly retryAfter?: number;

    constructor(
      message: string,
      details: {
        status: number;
        code?: string;
        requestId?: string;
        retryAfter?: number;
      },
    ) {
      super(message);
      this.name = "CreativeClientError";
      this.status = details.status;
      this.code = details.code;
      this.requestId = details.requestId;
      this.retryAfter = details.retryAfter;
    }
  }

  return {
    CreativeClientError,
    generateCopy: vi.fn(),
    generateImage: vi.fn(),
  };
});

const assetRepositoryMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  listPage: vi.fn(),
  put: vi.fn(),
  updateMetadata: vi.fn(),
}));

const thumbnailMock = vi.hoisted(() => vi.fn());
const cloudAssetMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
  updateMetadata: vi.fn(),
}));

vi.mock("@/core/project/ProjectEngine", () => ({
  projectEngine: projectEngineMock,
}));

vi.mock("@/services/creative", () => ({
  CreativeClientError: creativeApiMock.CreativeClientError,
  generateCreativeCopy: creativeApiMock.generateCopy,
  generateCreativeImage: creativeApiMock.generateImage,
}));

vi.mock("@/core/storage/CreativeAssetRepository", () => ({
  creativeAssetRepository: assetRepositoryMock,
}));

vi.mock("@/core/storage/createImageThumbnail", () => ({
  createImageThumbnail: thumbnailMock,
}));

vi.mock("@/core/assets/client", () => ({
  cloudCreativeAssets: cloudAssetMock,
}));

import CreativeStudio from "@/components/creative/CreativeStudio";

const CREATED_AT = "2026-08-01T12:00:00.000Z";

function createMemory(): CreativeStudioMemory {
  const brief = {
    brandName: "VAEORA",
    audience: "Founders building category-defining technology brands.",
    offer: "A complete intelligent brand and web presence.",
    personality: "premium, intelligent, organic, mysterious",
    visualDirection: "Restrained violet light emerging from near-black.",
    constraints: "No generic sci-fi symbols.",
    locale: "es" as const,
  };

  return {
    schemaVersion: 1,
    brief,
    brandRevisionId: "revision-current",
    briefHistory: [
      {
        id: "revision-current",
        brief,
        createdAt: CREATED_AT,
      },
    ],
    outputs: {},
    outputHistory: {},
    assets: [],
    updatedAt: CREATED_AT,
  };
}

function createProject(): IAuraProject {
  return {
    id: "vaeora-project",
    name: "VAEORA",
    description: "An intelligent creative system.",
    goal: "Build a complete brand world.",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    status: "building",
    studios: {
      branding: true,
      website: false,
      app: false,
      marketing: false,
      documents: false,
    },
    creativeStudio: createMemory(),
  };
}

function renderStudio({
  initialArea = "image" as const,
  onClose = vi.fn(),
  project = createProject(),
}: {
  initialArea?: "direction" | "image" | "website" | "library";
  onClose?: () => void;
  project?: IAuraProject;
} = {}) {
  render(
    <CreativeStudio
      project={project}
      initialArea={initialArea}
      onClose={onClose}
    />,
  );

  return { onClose, project };
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();

  assetRepositoryMock.listPage.mockResolvedValue({
    assets: [],
    nextCursor: null,
    hasMore: false,
  });
  assetRepositoryMock.updateMetadata.mockResolvedValue(undefined);
  assetRepositoryMock.delete.mockResolvedValue(undefined);
  cloudAssetMock.list.mockResolvedValue([]);
  cloudAssetMock.get.mockResolvedValue(null);
  cloudAssetMock.put.mockResolvedValue(undefined);
  cloudAssetMock.updateMetadata.mockResolvedValue(undefined);
  cloudAssetMock.delete.mockResolvedValue(undefined);
  thumbnailMock.mockResolvedValue(
    new Blob(["thumbnail"], { type: "image/webp" }),
  );
  projectEngineMock.updateCreativeStudio.mockImplementation(
    (_projectId: string, memory: CreativeStudioMemory) => ({
      ...createProject(),
      creativeStudio: memory,
    }),
  );

  let objectUrlIndex = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    () => `blob:creative-test-${++objectUrlIndex}`,
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CreativeStudio", () => {
  it("exposes the selected image presets through aria-pressed", async () => {
    const user = userEvent.setup();
    renderStudio();

    const logoPreset = await screen.findByRole("button", {
      name: /Logo concept/i,
    });
    const websiteHeroPreset = screen.getByRole("button", {
      name: /Website hero/i,
    });
    const squarePreset = screen.getByRole("button", { name: /^Square/i });
    const heroPreset = screen.getByRole("button", { name: /^Hero/i });
    const exploreTier = screen.getByRole("button", { name: /^Explore/i });
    const studioTier = screen.getByRole("button", { name: /^Studio/i });

    expect(logoPreset).toHaveAttribute("aria-pressed", "true");
    expect(websiteHeroPreset).toHaveAttribute("aria-pressed", "false");
    expect(squarePreset).toHaveAttribute("aria-pressed", "true");
    expect(heroPreset).toHaveAttribute("aria-pressed", "false");
    expect(exploreTier).toHaveAttribute("aria-pressed", "true");
    expect(studioTier).toHaveAttribute("aria-pressed", "false");

    await user.click(websiteHeroPreset);

    expect(logoPreset).toHaveAttribute("aria-pressed", "false");
    expect(websiteHeroPreset).toHaveAttribute("aria-pressed", "true");
    expect(squarePreset).toHaveAttribute("aria-pressed", "false");
    expect(heroPreset).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a failed IndexedDB generation session-only without persisting ghost metadata", async () => {
    const user = userEvent.setup();
    const imageBlob = new Blob(["generated-image"], { type: "image/png" });

    creativeApiMock.generateImage.mockResolvedValue({
      blob: imageBlob,
      metadata: {
        requestId: "request-1",
        assetId: "asset-session-only",
        width: 1024,
        height: 1024,
        experimental: false,
        mimeType: "image/png",
        model: "gpt-image-2",
        createdAt: "2026-08-01T12:05:00.000Z",
      },
    });
    assetRepositoryMock.put.mockRejectedValueOnce(
      new Error("IndexedDB quota exceeded"),
    );
    cloudAssetMock.put.mockRejectedValueOnce(
      new Error("Cloud storage unavailable"),
    );

    renderStudio();

    const prompt = await screen.findByLabelText(/debe tomar forma/i);
    projectEngineMock.updateCreativeStudio.mockClear();

    await user.type(
      prompt,
      "An asymmetrical intelligent light structure suspended in darkness.",
    );
    await user.click(
      screen.getByRole("button", { name: "Generar vista previa" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /solo para esta sesi.n/i,
    );
    expect(thumbnailMock).toHaveBeenCalledWith(imageBlob);
    expect(assetRepositoryMock.put).toHaveBeenCalledTimes(1);
    expect(projectEngineMock.updateCreativeStudio).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Abrir biblioteca" }),
    );
    expect(screen.getByText("Session only")).toBeInTheDocument();
  }, 10_000);

  it("reveals a generated preview before IndexedDB persistence finishes", async () => {
    const user = userEvent.setup();
    const imageBlob = new Blob(["generated-image"], { type: "image/png" });
    let finishPersistence: (() => void) | undefined;

    creativeApiMock.generateImage.mockResolvedValue({
      blob: imageBlob,
      metadata: {
        requestId: "request-fast-preview",
        assetId: "asset-fast-preview",
        width: 1024,
        height: 1024,
        experimental: false,
        mimeType: "image/png",
        model: "gpt-image-2",
        createdAt: "2026-08-01T12:06:00.000Z",
      },
    });
    assetRepositoryMock.put.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPersistence = resolve;
        }),
    );

    renderStudio();
    await user.type(
      await screen.findByLabelText(/debe tomar forma/i),
      "An asymmetric green energy field suspended in darkness.",
    );
    await user.click(
      screen.getByRole("button", { name: "Generar vista previa" }),
    );

    expect(
      await screen.findByAltText("Logo concept para VAEORA"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generar vista previa" }),
    ).not.toBeDisabled();
    expect(assetRepositoryMock.put).toHaveBeenCalledTimes(1);

    finishPersistence?.();
    await waitFor(() => {
      expect(projectEngineMock.updateCreativeStudio).toHaveBeenCalled();
    });
  });

  it("generates a coordinated six-asset Brand Kit instead of invisible copy", async () => {
    const user = userEvent.setup();
    let activeRequests = 0;
    let peakActiveRequests = 0;

    creativeApiMock.generateImage.mockImplementation(
      async (request: {
        intent: string;
        aspect: string;
        tier: string;
      }) => {
        activeRequests += 1;
        peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
        await Promise.resolve();
        activeRequests -= 1;

        return {
          blob: new Blob([`generated-${request.intent}`], {
            type: "image/png",
          }),
          metadata: {
            requestId: `request-${request.intent}`,
            assetId: `asset-${request.intent}`,
            width: request.aspect === "portrait" ? 1024 : 1536,
            height: request.aspect === "portrait" ? 1536 : 1024,
            experimental: false,
            mimeType: "image/png",
            model: "gpt-image-2",
            createdAt: CREATED_AT,
          },
        };
      },
    );

    renderStudio();
    await user.click(
      await screen.findByRole("button", {
        name: "Generar Brand Kit · 6 assets",
      }),
    );

    await waitFor(() => {
      expect(creativeApiMock.generateImage).toHaveBeenCalledTimes(6);
    });
    expect(peakActiveRequests).toBe(1);
    expect(
      creativeApiMock.generateImage.mock.calls.map(([request]) => ({
        intent: request.intent,
        aspect: request.aspect,
        tier: request.tier,
      })),
    ).toEqual([
      { intent: "logo-mark", aspect: "square", tier: "draft" },
      { intent: "website-hero", aspect: "hero", tier: "draft" },
      { intent: "editorial-photo", aspect: "landscape", tier: "draft" },
      { intent: "product-shot", aspect: "square", tier: "draft" },
      { intent: "social-visual", aspect: "portrait", tier: "draft" },
      { intent: "brand-texture", aspect: "landscape", tier: "draft" },
    ]);
    const operationIds = creativeApiMock.generateImage.mock.calls.map(
      ([request]) => request.operationId,
    );
    expect(operationIds.every((operationId) => Boolean(operationId))).toBe(true);
    expect(new Set(operationIds).size).toBe(6);
    await waitFor(() => {
      expect(assetRepositoryMock.put).toHaveBeenCalledTimes(6);
      expect(screen.getByText("6 de 6 listos")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/^Guardado ·/)).toHaveLength(6);
  });

  it("preserves completed Brand Kit assets when one formation fails", async () => {
    const user = userEvent.setup();
    let requestIndex = 0;

    creativeApiMock.generateImage.mockImplementation(
      async (request: { intent: string }) => {
        requestIndex += 1;
        if (requestIndex === 3) throw new Error("Editorial formation failed");

        return {
          blob: new Blob([`generated-${request.intent}`], {
            type: "image/png",
          }),
          metadata: {
            requestId: `request-${request.intent}`,
            assetId: `asset-${request.intent}`,
            width: 1024,
            height: 1024,
            experimental: false,
            mimeType: "image/png",
            model: "gpt-image-2",
            createdAt: CREATED_AT,
          },
        };
      },
    );

    renderStudio();
    await user.click(
      await screen.findByRole("button", {
        name: "Generar Brand Kit · 6 assets",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Brand Kit parcial: 5 de 6 assets listos/i,
    );
    expect(creativeApiMock.generateImage).toHaveBeenCalledTimes(6);
    expect(assetRepositoryMock.put).toHaveBeenCalledTimes(5);
    expect(screen.getByText(/Error · Editorial formation failed/i)).toBeVisible();
    expect(screen.getByText("5 de 6 listos")).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Reintentar 1 asset pendiente",
      }),
    );
    await waitFor(() => {
      expect(creativeApiMock.generateImage).toHaveBeenCalledTimes(7);
      expect(screen.getByText("6 de 6 listos")).toBeVisible();
    });
    expect(
      creativeApiMock.generateImage.mock.calls[6]?.[0].intent,
    ).toBe("editorial-photo");
  });

  it("recovers automatically from a short Brand Kit rate limit", async () => {
    const user = userEvent.setup();
    let requestIndex = 0;

    creativeApiMock.generateImage.mockImplementation(
      async (request: { intent: string; aspect: string }) => {
        requestIndex += 1;
        if (requestIndex === 1) {
          throw new creativeApiMock.CreativeClientError(
            "Creative generation is already in progress.",
            {
              status: 429,
              code: "VAEORA_RATE_LIMITED",
              retryAfter: 1,
            },
          );
        }

        return {
          blob: new Blob([`generated-${request.intent}`], {
            type: "image/png",
          }),
          metadata: {
            requestId: `request-${requestIndex}`,
            assetId: `asset-${requestIndex}`,
            width: request.aspect === "portrait" ? 1024 : 1536,
            height: request.aspect === "portrait" ? 1536 : 1024,
            experimental: false,
            mimeType: "image/png",
            model: "gpt-image-2",
            createdAt: CREATED_AT,
          },
        };
      },
    );

    renderStudio();
    await user.click(
      await screen.findByRole("button", {
        name: "Generar Brand Kit · 6 assets",
      }),
    );

    expect(
      await screen.findByText(/Reintentando automáticamente en 1s/i),
    ).toBeVisible();
    await waitFor(
      () => {
        expect(creativeApiMock.generateImage).toHaveBeenCalledTimes(7);
        expect(screen.getByText("6 de 6 listos")).toBeVisible();
      },
      { timeout: 4_000 },
    );
  });

  it("pauses a Brand Kit with a visible countdown on a long usage limit", async () => {
    const user = userEvent.setup();

    creativeApiMock.generateImage.mockRejectedValueOnce(
      new creativeApiMock.CreativeClientError(
        "Creative generation reached its temporary usage limit.",
        {
          status: 429,
          code: "VAEORA_RATE_LIMITED",
          retryAfter: 120,
        },
      ),
    );

    renderStudio();
    await user.click(
      await screen.findByRole("button", {
        name: "Generar Brand Kit · 6 assets",
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Reintentar en 2:00" }),
    ).toBeDisabled();
    expect(screen.getAllByText(/^Pausado · Disponible en/)).toHaveLength(6);
    expect(creativeApiMock.generateImage).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation before Escape closes unsaved direction changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderStudio({ initialArea: "direction", onClose });

    const brandName = await screen.findByLabelText("Nombre de marca");
    await user.type(brandName, " Labs");
    await user.keyboard("{Escape}");

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/cambios de direcci.n sin guardar/i),
    );
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates persisted asset metadata without reading or rewriting its 4K original", async () => {
    const user = userEvent.setup();
    const metadata = {
      id: "asset-persisted",
      projectId: "vaeora-project",
      kind: "website-hero" as const,
      title: "Website hero · 1",
      status: "draft" as const,
      blobKey: "asset-persisted",
      prompt: "A restrained field of intelligent light.",
      altText: "Abstract violet brand field",
      width: 3840,
      height: 2160,
      mimeType: "image/webp" as const,
      byteSize: 18_000_000,
      model: "gpt-image-2",
      quality: "high" as const,
      tier: "ultra" as const,
      experimental: true,
      brandRevisionId: "revision-current",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };
    assetRepositoryMock.listPage.mockResolvedValueOnce({
      assets: [
        {
          metadata,
          thumbnail: new Blob(["preview"], { type: "image/webp" }),
        },
      ],
      nextCursor: null,
      hasMore: false,
    });

    renderStudio({ initialArea: "library" });

    await user.click(
      await screen.findByRole("button", {
        name: /Aprobar Website hero/i,
      }),
    );

    await waitFor(() => {
      expect(assetRepositoryMock.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ id: metadata.id, status: "approved" }),
      );
    });
    expect(assetRepositoryMock.get).not.toHaveBeenCalled();
    expect(assetRepositoryMock.put).not.toHaveBeenCalled();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(
      screen.getByRole("button", {
        name: /Eliminar localmente Website hero/i,
      }),
    );
    await waitFor(() => {
      expect(assetRepositoryMock.delete).toHaveBeenCalledWith(metadata.id);
    });
    expect(screen.queryByText(metadata.title)).not.toBeInTheDocument();
  });

  it("separates saving an original from deleting the active concept", async () => {
    const user = userEvent.setup();
    const metadata = {
      id: "asset-active-concept",
      projectId: "vaeora-project",
      kind: "logo-mark" as const,
      title: "Logo concept · 1",
      status: "draft" as const,
      blobKey: "asset-active-concept",
      prompt: "An organic premium mark.",
      altText: "Organic green and gold mark",
      width: 1024,
      height: 1024,
      mimeType: "image/png" as const,
      byteSize: 826_000,
      model: "gpt-image-2",
      quality: "medium" as const,
      tier: "draft" as const,
      experimental: false,
      brandRevisionId: "revision-current",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };
    assetRepositoryMock.listPage.mockResolvedValueOnce({
      assets: [
        {
          metadata,
          thumbnail: new Blob(["preview"], { type: "image/webp" }),
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderStudio();

    expect(
      await screen.findByRole("button", { name: "Guardar archivo original" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: `Eliminar concepto ${metadata.title}`,
      }),
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/no se puede deshacer/i),
    );
    await waitFor(() => {
      expect(assetRepositoryMock.delete).toHaveBeenCalledWith(metadata.id);
    });
    expect(assetRepositoryMock.get).not.toHaveBeenCalled();
    expect(
      screen.getByText(/No hay un asset todav.a/i),
    ).toBeInTheDocument();
  });

  it("protects an unsaved structured-output edit when changing area or closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const project = createProject();
    project.creativeStudio = {
      ...createMemory(),
      outputs: {
        "brand-foundation": {
          deliverable: "brand-foundation",
          data: {
            positioning: "A precise creative intelligence.",
            brandPromise: "Coherence from idea to expression.",
            audience: "Ambitious founders.",
            mission: "Shape intelligent brands.",
            values: ["clarity"],
            voice: {
              traits: ["precise"],
              principles: ["say only what matters"],
              avoid: ["generic claims"],
            },
            taglineOptions: ["Where intelligence takes shape."],
          },
          model: "gpt-5.6-terra",
          brandRevisionId: "revision-current",
          generatedAt: CREATED_AT,
        },
      },
    };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderStudio({ initialArea: "direction", onClose, project });
    await user.click(
      await screen.findByRole("button", { name: "Editar contenido" }),
    );
    const editor = screen.getByLabelText("Editor estructurado JSON");
    await user.type(editor, " ");
    await user.click(screen.getByRole("button", { name: /Image Lab/i }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/edici.n de contenido sin guardar/i),
    );
    expect(screen.getByLabelText("Editor estructurado JSON")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("initializes storage once when the synchronized project rerenders its parent", async () => {
    function StatefulStudio() {
      const [project, setProject] = useState(createProject);

      return (
        <CreativeStudio
          project={project}
          initialArea="direction"
          onProjectUpdated={setProject}
          onClose={() => undefined}
        />
      );
    }

    render(<StatefulStudio />);

    await screen.findByRole("button", { name: "Cerrar Creative Studio" });
    await waitFor(() => {
      expect(assetRepositoryMock.listPage).toHaveBeenCalledTimes(1);
    });
  });
});
