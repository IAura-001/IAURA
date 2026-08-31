import type { IAuraProject } from "@/types/project";
import { portableAssetMetadata } from "@/core/assets/contracts";
import type { CreativeAssetMetadata } from "@/types/creative-studio";

export interface ExportAssetRecord {
  metadata: CreativeAssetMetadata;
  originalPath: string;
  available: boolean;
}

export function projectExportManifest(project: IAuraProject, assets: ExportAssetRecord[]) {
  return {
    schemaVersion: 1,
    exportType: "vaeora-project",
    project: {
      id: project.id, name: project.name, description: project.description, goal: project.goal,
      createdAt: project.createdAt, updatedAt: project.updatedAt, status: project.status,
      kind: project.kind, studios: project.studios, themeDNA: project.themeDNA,
      branding: project.branding, brandingStudio: project.brandingStudio,
      creativeStudio: project.creativeStudio ? {
        ...project.creativeStudio,
        assets: project.creativeStudio.assets.map(portableAssetMetadata),
      } : undefined,
      launchStudio: project.launchStudio,
      commercialOnboarding: project.commercialOnboarding,
    },
    assets: assets.map(({ metadata, available }) => ({
      metadata: portableAssetMetadata(metadata), available,
      archivePath: available ? `assets/${metadata.id}.${metadata.mimeType.split("/")[1]}` : null,
    })),
    limitations: {
      conversationsIncluded: false,
      note: "Conversation export remains an account-export gap; no system prompts or analytics are included.",
    },
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data: Uint8Array) {
  let crc = 0xffffffff; for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(value: number) { const data = new Uint8Array(2); new DataView(data.buffer).setUint16(0, value, true); return data; }
function u32(value: number) { const data = new Uint8Array(4); new DataView(data.buffer).setUint32(0, value, true); return data; }
function concat(parts: Uint8Array[]) { const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }

export function createStoredZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder(); const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    if (!/^[a-zA-Z0-9._/-]{1,240}$/.test(entry.name) || entry.name.includes("..")) throw new Error("Unsafe archive path.");
    const name = encoder.encode(entry.name); const checksum = crc32(entry.data);
    const header = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum),
      u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name]);
    local.push(header, entry.data);
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum),
      u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.length + entry.data.length;
  }
  const directory = concat(central); const end = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length),
    u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
  return concat([...local, directory, end]);
}
