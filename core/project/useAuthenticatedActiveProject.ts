"use client";

import { useSyncExternalStore } from "react";

import {
  AuthenticatedProjectRepository,
  authenticatedProjectRepository,
} from "./AuthenticatedProjectRepository";

export function useAuthenticatedActiveProject(
  repository: AuthenticatedProjectRepository = authenticatedProjectRepository,
) {
  const activeProjectId = useSyncExternalStore(
    (listener) => repository.subscribe(listener),
    () => repository.getSnapshot().activeProjectId,
    () => repository.getSnapshot().activeProjectId,
  );

  return activeProjectId ? repository.getProject(activeProjectId) : null;
}
