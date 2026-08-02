import type { NextConfig } from "next";

function configuredDevHosts(): string[] {
  return (process.env.VAEORA_ALLOWED_ORIGINS ?? "")
    .split(",")
    .flatMap((value) => {
      try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:"
          ? [url.hostname]
          : [];
      } catch {
        return [];
      }
    });
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...configuredDevHosts()],
};

export default nextConfig;
