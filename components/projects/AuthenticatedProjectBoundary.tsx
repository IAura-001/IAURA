"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { memoryRepository } from "@/core/memory/MemoryRepository";
import { authenticatedProjectRepository } from "@/core/project/AuthenticatedProjectRepository";
import type { IAuraProject } from "@/core/project/types";

interface AuthenticatedProjectBoundaryProps {
  userId: string;
  projects: IAuraProject[];
  activeProjectId: string | null;
  remoteStateExists: boolean;
  children: ReactNode;
}

function mirrorActiveProjectToMemory(): void {
  const activeProject =
    authenticatedProjectRepository.getActiveProject();

  const currentMemory =
    memoryRepository.getMemory();

  if (
    JSON.stringify(currentMemory.activeProject) ===
    JSON.stringify(activeProject)
  ) {
    return;
  }

  memoryRepository.saveMemory({
    ...currentMemory,
    activeProject,
  });
}

export default function AuthenticatedProjectBoundary({
  userId,
  projects,
  activeProjectId,
  remoteStateExists,
  children,
}: AuthenticatedProjectBoundaryProps) {
  return (
    <BoundaryInstance
      key={userId}
      userId={userId}
      projects={projects}
      activeProjectId={activeProjectId}
      remoteStateExists={remoteStateExists}
    >
      {children}
    </BoundaryInstance>
  );
}

function BoundaryInstance({
  userId,
  projects,
  activeProjectId,
  remoteStateExists,
  children,
}: AuthenticatedProjectBoundaryProps) {
  const [configured] = useState(() => {
    const initialActiveProjectId =
      remoteStateExists
        ? activeProjectId
        : null;

    authenticatedProjectRepository.configure(
      userId,
      projects,
      initialActiveProjectId,
      !remoteStateExists,
    );

    mirrorActiveProjectToMemory();

    return true;
  });

  useEffect(() => {
    const unsubscribe =
      authenticatedProjectRepository.subscribe(() => {
        mirrorActiveProjectToMemory();
      });

    return () => {
      unsubscribe();
      authenticatedProjectRepository.reset();
    };
  }, []);

  return configured ? children : null;
}
