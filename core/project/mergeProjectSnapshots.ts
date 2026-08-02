import type { IAuraProject } from "@/types/project";

interface TimestampedValue {
  updatedAt: string;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function preferredSnapshot<Value extends TimestampedValue>(
  stored: Value | undefined,
  iaura: Value | undefined,
): Value | undefined {
  if (!stored) return iaura;
  if (!iaura) return stored;

  return timestamp(iaura.updatedAt) >= timestamp(stored.updatedAt)
    ? iaura
    : stored;
}

export function mergeProjectSnapshots(
  stored: IAuraProject,
  iaura: IAuraProject,
): IAuraProject {
  if (stored.id !== iaura.id) {
    throw new Error("Only snapshots of the same project can be merged.");
  }

  const iauraIsNewer =
    timestamp(iaura.updatedAt) >= timestamp(stored.updatedAt);
  const older = iauraIsNewer ? stored : iaura;
  const newer = iauraIsNewer ? iaura : stored;

  return {
    ...older,
    ...newer,
    id: stored.id,
    createdAt:
      timestamp(stored.createdAt) <= timestamp(iaura.createdAt)
        ? stored.createdAt
        : iaura.createdAt,
    updatedAt:
      timestamp(stored.updatedAt) >= timestamp(iaura.updatedAt)
        ? stored.updatedAt
        : iaura.updatedAt,
    studios: {
      branding: stored.studios.branding || iaura.studios.branding,
      website: stored.studios.website || iaura.studios.website,
      app: stored.studios.app || iaura.studios.app,
      marketing: stored.studios.marketing || iaura.studios.marketing,
      documents: stored.studios.documents || iaura.studios.documents,
    },
    branding: preferredSnapshot(stored.branding, iaura.branding),
    brandingStudio: preferredSnapshot(
      stored.brandingStudio,
      iaura.brandingStudio,
    ),
    launchStudio: preferredSnapshot(stored.launchStudio, iaura.launchStudio),
    creativeStudio: preferredSnapshot(
      stored.creativeStudio,
      iaura.creativeStudio,
    ),
  };
}
