import type { IAuraProject } from "@/types/project";

const LEADING_INTENT = /^(?:i\s+(?:want|need|am planning)\s+to\s+|help me\s+|let'?s\s+)?(?:launch|build|create|start|turn)\s+/i;
const TRAILING_CONTEXT = /\s+(?:for|aimed at|targeting|so that|because)\s+.+$/i;

export function normalizeLaunchIntent(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 12 ? normalized.slice(0, 1200) : null;
}

export function provisionalLaunchName(intent: string): string {
  const explicitName = intent.match(/(?:called|named)\s+["“]?([a-z0-9][a-z0-9 '&-]{1,48})["”]?/i)?.[1]
    ?.replace(/[.,!?].*$/, "").trim();
  if (explicitName) return explicitName;
  const expertiseOffer = intent.match(/turn\s+my\s+(.+?)\s+experience\s+into\s+(?:a\s+)?(?:paid\s+)?(.+?)(?:\s+offer)?[.!?]*$/i);
  if (expertiseOffer) {
    const title = [expertiseOffer[1], expertiseOffer[2]].join(" ").split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    return `${title} Launch`.slice(0, 80);
  }
  const subject = intent.replace(LEADING_INTENT, "").replace(TRAILING_CONTEXT, "")
    .replace(/[.!?]+$/, "").trim().split(/\s+/).slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  return `${subject || "New"} Launch`.slice(0, 80);
}

export function shouldEnterCommercialOnboarding(
  hasCompletedWelcome: boolean,
  projects: IAuraProject[],
): boolean {
  return !hasCompletedWelcome && projects.length === 0;
}

export type CommercialNextAction = "continue-with-aura" | "build-brand-system" |
  "approve-first-visual" | "develop-website-messaging";

export function commercialNextAction(project: IAuraProject): CommercialNextAction {
  if (!project.description.trim()) return "continue-with-aura";
  if (!project.themeDNA && !project.branding) return "build-brand-system";
  if (!project.creativeStudio?.assets.some((asset) => asset.status === "approved")) {
    return "approve-first-visual";
  }
  return "develop-website-messaging";
}
