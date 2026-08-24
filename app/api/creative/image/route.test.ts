import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  CREATIVE_IMAGE_RESPONSE_HEADERS,
} from "@/core/creative/types";
import {
  resetCreativeGenerationLimitsForTests,
} from "@/core/creative/limits";

const mocks = vi.hoisted(() => ({
  hasValidAccessConfiguration: vi.fn(),
  isRequestAuthorized: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  generateImage: vi.fn(),
  createProvider: vi.fn(),
  reserveUsage: vi.fn(),
}));
vi.mock("@/core/auth/session", async () => {
  const { NextResponse } = await import("next/server");
  return {
    getAuthenticatedUser: mocks.getAuthenticatedUser,
    authenticationRequiredResponse: () => NextResponse.json(
      { error: "IAURA authentication required.", code: "IAURA_AUTH_REQUIRED" },
      { status: 401 },
    ),
  };
});

vi.mock("@/core/auth/access", () => ({
  ACCESS_COOKIE_NAME: "iaura_beta_access",
  hasValidAccessConfiguration:
    mocks.hasValidAccessConfiguration,
  isRequestAuthorized: mocks.isRequestAuthorized,
}));

vi.mock(
  "@/services/providers/OpenAICreativeProvider",
  () => ({
    createOpenAICreativeProvider: mocks.createProvider,
  }),
);
vi.mock("@/core/aiUsage/server", () => ({ reserveAiUsage: mocks.reserveUsage,
  aiLimitResponse: () => new Response(null, { status: 429 }) }));

import { POST } from "./route";

const validBody = {
  projectId: "project-1",
  intent: "website-hero",
  aspect: "hero",
  tier: "premium",
  brief: "An organic intelligent field with restrained violet light.",
  brand: {
    name: "VAEORA",
    mission: "Where intelligence takes shape.",
  },
};

const validImageResult = {
  data: Uint8Array.from([0x52, 0x49, 0x46, 0x46]).buffer,
  byteLength: 4,
  mimeType: "image/webp",
  width: 1536,
  height: 1024,
  experimental: false,
  provider: "openai",
  model: "gpt-image-2",
  createdAt: "2026-08-01T12:00:00.000Z",
};

function jsonRequest(body: unknown): Request {
  return new Request("https://vaeora.test/api/creative/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://vaeora.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/creative/image", () => {
  beforeEach(() => {
    resetCreativeGenerationLimitsForTests();
    mocks.hasValidAccessConfiguration.mockReset();
    mocks.isRequestAuthorized.mockReset();
    mocks.generateImage.mockReset();
    mocks.createProvider.mockReset();
    mocks.reserveUsage.mockReset().mockResolvedValue({ complete: vi.fn(), fail: vi.fn() });
    mocks.hasValidAccessConfiguration.mockReturnValue(true);
    mocks.isRequestAuthorized.mockReturnValue(true);
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-a" });
    mocks.createProvider.mockReturnValue({
      generateImage: mocks.generateImage,
    });
  });

  afterEach(() => {
    resetCreativeGenerationLimitsForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed before authorization when access is not configured", async () => {
    mocks.hasValidAccessConfiguration.mockReturnValue(false);

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_ACCESS_NOT_CONFIGURED",
    });
    expect(mocks.isRequestAuthorized).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("requires private access", async () => {
    mocks.isRequestAuthorized.mockReturnValue(false);

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_ACCESS_REQUIRED",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("fails closed in production without acknowledged external cost controls", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VAEORA_CREATIVE_PRODUCTION_GUARD", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "VAEORA_CREATIVE_NOT_CONFIGURED",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("rejects an incompatible logo aspect before provider creation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      jsonRequest({
        ...validBody,
        intent: "logo-mark",
        aspect: "hero",
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "VAEORA_UNSUPPORTED_PRESET",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("returns image bytes and complete provenance headers", async () => {
    const bytes = new Uint8Array(validImageResult.data);
    mocks.generateImage.mockResolvedValue(validImageResult);

    const response = await POST(jsonRequest(validBody));
    const resultBytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe(
      "nosniff",
    );
    expect(
      response.headers.get(CREATIVE_IMAGE_RESPONSE_HEADERS.assetId),
    ).toMatch(/^asset_/);
    expect(
      response.headers.get(CREATIVE_IMAGE_RESPONSE_HEADERS.width),
    ).toBe("1536");
    expect(
      response.headers.get(CREATIVE_IMAGE_RESPONSE_HEADERS.model),
    ).toBe("gpt-image-2");
    expect(
      response.headers.get(CREATIVE_IMAGE_RESPONSE_HEADERS.createdAt),
    ).toBe("2026-08-01T12:00:00.000Z");
    expect(resultBytes).toEqual(bytes);
  });

  it("deduplicates one operation while allowing an intentional new operation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateImage.mockResolvedValue(validImageResult);
    const firstBody = { ...validBody, operationId: "brand-kit-run-1-hero" };

    expect((await POST(jsonRequest(firstBody))).status).toBe(200);

    const duplicate = await POST(jsonRequest(firstBody));
    expect(duplicate.status).toBe(429);
    expect(duplicate.headers.get("retry-after")).toBe("30");

    const newOperation = await POST(
      jsonRequest({ ...validBody, operationId: "brand-kit-run-2-hero" }),
    );
    expect(newOperation.status).toBe(200);
    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
  });

  it("limits concurrent paid image generations", async () => {
    let completeGeneration: (value: typeof validImageResult) => void = () => {
      throw new Error("The pending generation resolver was not captured.");
    };
    mocks.generateImage.mockImplementation(
      () =>
        new Promise<typeof validImageResult>((resolve) => {
          completeGeneration = resolve;
        }),
    );

    const firstResponse = POST(jsonRequest(validBody));
    await vi.waitFor(() => {
      expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    });

    const blocked = await POST(jsonRequest(validBody));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("5");
    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    completeGeneration(validImageResult);
    expect((await firstResponse).status).toBe(200);
  });

  it("never exposes provider errors or request contents", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateImage.mockRejectedValue(
      new Error("provider detail and private prompt"),
    );

    const response = await POST(jsonRequest(validBody));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).toContain("VAEORA_PROVIDER_ERROR");
    expect(text).not.toContain("provider detail");
    expect(text).not.toContain(validBody.brief);
  });
});
