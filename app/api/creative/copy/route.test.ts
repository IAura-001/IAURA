import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CreativeProviderError } from "@/core/creative/errors";
import {
  resetCreativeGenerationLimitsForTests,
} from "@/core/creative/limits";

const mocks = vi.hoisted(() => ({
  hasValidAccessConfiguration: vi.fn(),
  isRequestAuthorized: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  generateCopy: vi.fn(),
  createProvider: vi.fn(),
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

import { POST } from "./route";

const validBody = {
  projectId: "project-1",
  deliverable: "brand-foundation",
  locale: "es",
  brief: "Define una base de marca precisa y diferenciada.",
  brand: {
    name: "VAEORA",
    mission: "Dar forma coherente a ideas inteligentes.",
  },
};

const validResult = {
  deliverable: "brand-foundation",
  content: {
    positioning: "Inteligencia creativa convertida en sistemas coherentes.",
    brandPromise: "De la intención a una presencia precisa.",
    audience: "Fundadores y equipos que construyen marcas ambiciosas.",
    mission: "Dar una forma clara y útil a la inteligencia creativa.",
    values: ["Claridad", "Coherencia", "Originalidad"],
    voice: {
      traits: ["Precisa", "Serena", "Inteligente"],
      principles: [
        "Decir solo lo esencial.",
        "Convertir abstracción en dirección.",
        "Mantener una tensión humana.",
      ],
      avoid: ["Promesas vacías", "Jerga genérica"],
    },
    taglineOptions: [
      "La inteligencia toma forma.",
      "Una dirección empieza a emerger.",
      "Ideas convertidas en presencia.",
    ],
  },
  provider: "openai",
  model: "gpt-5.6-terra",
  createdAt: "2026-08-01T12:00:00.000Z",
};

function jsonRequest(body: string): Request {
  return new Request("https://vaeora.test/api/creative/copy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://vaeora.test",
    },
    body,
  });
}

describe("POST /api/creative/copy", () => {
  beforeEach(() => {
    resetCreativeGenerationLimitsForTests();
    mocks.hasValidAccessConfiguration.mockReset();
    mocks.isRequestAuthorized.mockReset();
    mocks.generateCopy.mockReset();
    mocks.createProvider.mockReset();
    mocks.hasValidAccessConfiguration.mockReturnValue(true);
    mocks.isRequestAuthorized.mockReturnValue(true);
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-a" });
    mocks.createProvider.mockReturnValue({
      generateCopy: mocks.generateCopy,
    });
  });

  afterEach(() => {
    resetCreativeGenerationLimitsForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed before authorization when access is not configured", async () => {
    mocks.hasValidAccessConfiguration.mockReturnValue(false);

    const response = await POST(
      new Request("https://vaeora.test/api/creative/copy", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_ACCESS_NOT_CONFIGURED",
    });
    expect(mocks.isRequestAuthorized).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("requires private access before parsing the request", async () => {
    mocks.isRequestAuthorized.mockReturnValue(false);

    const response = await POST(
      new Request("https://vaeora.test/api/creative/copy", {
        method: "POST",
      }),
    );

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

    const response = await POST(jsonRequest(JSON.stringify(validBody)));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "VAEORA_CREATIVE_NOT_CONFIGURED",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without calling OpenAI", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(jsonRequest("{invalid"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VAEORA_INVALID_REQUEST",
      error: "The creative request body contains invalid JSON.",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("returns a typed structured deliverable with no-store headers", async () => {
    mocks.generateCopy.mockResolvedValue(validResult);

    const response = await POST(
      jsonRequest(JSON.stringify(validBody)),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe(
      "nosniff",
    );
    expect(data).toMatchObject({
      requestId: expect.any(String),
      result: validResult,
    });
    expect(mocks.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverable: "brand-foundation",
        brief: validBody.brief,
      }),
      expect.any(AbortSignal),
    );
  });

  it("maps provider throttling without exposing internal details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateCopy.mockRejectedValue(
      new CreativeProviderError("rate_limit", "provider-request"),
    );

    const response = await POST(
      jsonRequest(JSON.stringify(validBody)),
    );
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(text).toContain("VAEORA_RATE_LIMITED");
    expect(text).not.toContain("provider-request");
  });

  it("treats an intentional abort as cancellation without critical logging", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.generateCopy.mockRejectedValue(
      new DOMException("cancelled", "AbortError"),
    );

    const response = await POST(jsonRequest(JSON.stringify(validBody)));

    expect(response.status).toBe(499);
    await expect(response.json()).resolves.toMatchObject({
      code: "VAEORA_REQUEST_CANCELLED",
    });
    expect(errorLog).not.toHaveBeenCalled();
  });
});
