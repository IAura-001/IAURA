"use client";

import HomePage from "./HomePage";
import { useAuthenticatedIdentity } from "@/core/profile/AuthenticatedIdentityContext";
import type { WorkspaceEntryIntent, WorkspaceView } from "@/components/vaeora/VaeoraWorkspaceShell";

export default function AuthenticatedHomePage({ initialView, entryIntent }: { initialView?: WorkspaceView; entryIntent?: WorkspaceEntryIntent }) {
  const identity = useAuthenticatedIdentity();
  return <HomePage initialView={initialView} entryIntent={entryIntent} authenticatedUserId={identity?.id ?? "unauthenticated"} authenticatedDisplayName={identity?.displayName?.trim() ?? ""} />;
}
