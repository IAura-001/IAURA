import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function privateNetworkDevHosts(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter(
      (address) =>
        address.family === "IPv4" &&
        !address.internal &&
        isPrivateIpv4(address.address),
    )
    .map((address) => address.address);
}

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
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...privateNetworkDevHosts(),
    ...configuredDevHosts(),
  ],
};

export default nextConfig;
