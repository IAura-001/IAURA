import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertCreativeSameOrigin,
  normalizeCreativeOrigin,
} from "@/core/creative/http";

function request(origin: string, url = "https://vaeora.test/api/creative/copy") {
  return new Request(url, { headers: { Origin: origin } });
}

describe("creative request origins", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes scheme, hostname, port, and a trailing slash", () => {
    expect(normalizeCreativeOrigin(" HTTPS://VAEORA.TEST:443/ ")).toBe(
      "https://vaeora.test",
    );
    expect(normalizeCreativeOrigin("http://192.168.1.20:3001/")).toBe(
      "http://192.168.1.20:3001",
    );
  });

  it("allows same-origin and configured LAN/staging origins", () => {
    vi.stubEnv(
      "VAEORA_ALLOWED_ORIGINS",
      "http://192.168.1.20:3001/, https://staging.vaeora.test",
    );

    expect(() => assertCreativeSameOrigin(request("https://vaeora.test"))).not.toThrow();
    expect(() => assertCreativeSameOrigin(request("http://192.168.1.20:3001"))).not.toThrow();
    expect(() => assertCreativeSameOrigin(request("https://staging.vaeora.test/"))).not.toThrow();
  });

  it("allows loopback only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertCreativeSameOrigin(request("http://localhost:3001"))).not.toThrow();

    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertCreativeSameOrigin(request("http://localhost:3001"))).toThrowError(
      expect.objectContaining({ code: "VAEORA_ORIGIN_REJECTED" }),
    );
  });

  it("rejects unconfigured, malformed, and path-bearing origins", () => {
    vi.stubEnv("NODE_ENV", "production");

    for (const origin of [
      "https://evil.example",
      "not-an-origin",
      "https://vaeora.test/other",
    ]) {
      expect(() => assertCreativeSameOrigin(request(origin))).toThrowError(
        expect.objectContaining({ code: "VAEORA_ORIGIN_REJECTED" }),
      );
    }
  });
});
