import type { Metadata } from "next";

import AuthenticatedHomePage from "@/components/pages/AuthenticatedHomePage";
import type {
  WorkspaceEntryIntent,
  WorkspaceView,
} from "@/components/vaeora/VaeoraWorkspaceShell";

export const metadata: Metadata = {
  title: "IAURA — Personal Intelligence System",
  description:
    "IAURA piensa contigo para ayudarte a organizar tu vida, convertir ideas en proyectos y avanzar con claridad.",
};

interface IauraPageProps {
  searchParams: Promise<{
    view?: string | string[];
    intent?: string | string[];
  }>;
}

const WORKSPACE_VIEWS = new Set<WorkspaceView>([
  "presence",
  "projects",
  "intelligence",
]);

const ENTRY_INTENTS = new Set<WorkspaceEntryIntent>([
  "voice",
  "branding",
]);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function IauraPage({ searchParams }: IauraPageProps) {
  const params = await searchParams;
  const requestedView = firstParam(params.view);
  const requestedIntent = firstParam(params.intent);
  const initialView = WORKSPACE_VIEWS.has(requestedView as WorkspaceView)
    ? (requestedView as WorkspaceView)
    : "presence";
  const entryIntent = ENTRY_INTENTS.has(
    requestedIntent as WorkspaceEntryIntent,
  )
    ? (requestedIntent as WorkspaceEntryIntent)
    : undefined;

  return (
    <AuthenticatedHomePage
      initialView={initialView}
      entryIntent={entryIntent}
    />
  );
}
