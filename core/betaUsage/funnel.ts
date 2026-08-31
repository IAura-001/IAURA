import type { IAuraProject } from "@/types/project";

export const PRODUCT_EVENT_SCHEMA_VERSION = 1 as const;

export const DURABLE_OUTPUT_KINDS = [
  "confirmed_next_action",
  "audience_offer_direction",
  "brand_direction",
  "brand_system",
  "approved_visual_asset",
  "website_messaging",
  "launch_material",
  "launch_brief",
] as const;
export type DurableOutputKind = typeof DURABLE_OUTPUT_KINDS[number];

export const LAUNCH_FOUNDATION_MILESTONES = [
  "scoped_project",
  "audience_offer_direction",
  "brand_system",
  "approved_visual_asset",
  "website_messaging",
  "confirmed_next_action",
  "return_session",
] as const;
export type LaunchFoundationMilestone = typeof LAUNCH_FOUNDATION_MILESTONES[number];

const SAFE_SOURCES = new Set([
  "presence", "project", "project_form", "conversation", "project_persistence",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProductFunnelEvent {
  sessionId: string | null;
  eventKey: string | null;
  source: string | null;
  metadata: Record<string, string | boolean | number>;
}

export function normalizeProductFunnelEvent(body: Record<string, unknown>): ProductFunnelEvent | null {
  if (body.schemaVersion !== PRODUCT_EVENT_SCHEMA_VERSION) return null;
  const sessionId = typeof body.sessionId === "string" && UUID.test(body.sessionId)
    ? body.sessionId : null;
  const eventKey = typeof body.eventKey === "string" && /^[a-z0-9:_-]{1,240}$/i.test(body.eventKey)
    ? body.eventKey : null;
  const source = typeof body.source === "string" && SAFE_SOURCES.has(body.source)
    ? body.source : null;
  const metadata: Record<string, string | boolean | number> = {};
  if (body.inputMode === "text" || body.inputMode === "voice") metadata.input_mode = body.inputMode;
  if (typeof body.durableKind === "string" && DURABLE_OUTPUT_KINDS.includes(body.durableKind as DurableOutputKind)) {
    metadata.durable_kind = body.durableKind;
  }
  if (typeof body.milestone === "string" && /^[a-z0-9_-]{1,80}$/i.test(body.milestone)) {
    metadata.milestone = body.milestone;
  }
  return { sessionId, eventKey, source, metadata };
}

export function persistedLaunchMilestones(project: IAuraProject): DurableOutputKind[] {
  const result = new Set<DurableOutputKind>();
  const brief = project.creativeStudio?.brief;
  if (brief?.audience.trim() && brief.offer.trim()) result.add("audience_offer_direction");
  if (brief?.visualDirection.trim()) result.add("brand_direction");
  if (project.themeDNA || project.branding) result.add("brand_system");
  if (project.creativeStudio?.assets.some((asset) => asset.status === "approved")) result.add("approved_visual_asset");
  if (project.creativeStudio?.outputs["website-copy"]) result.add("website_messaging");
  if (project.launchStudio?.assets.some((asset) => asset.status === "approved")) result.add("launch_material");
  if (project.commercialOnboarding?.directionConfirmedAt) result.add("launch_brief");
  return [...result];
}

export function retentionFlags(
  baseline: string,
  sessionDates: string[],
): { d1: boolean; d7: boolean } {
  const start = new Date(baseline);
  const day = (value: string) => Math.floor((Date.parse(`${value.slice(0, 10)}T00:00:00Z`) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86_400_000);
  const offsets = sessionDates.map(day);
  return { d1: offsets.includes(1), d7: offsets.some((offset) => offset >= 6 && offset <= 8) };
}
