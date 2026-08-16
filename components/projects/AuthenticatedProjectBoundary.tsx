"use client";

import { useEffect, useState, type ReactNode } from "react";
import { authenticatedProjectRepository } from "@/core/project/AuthenticatedProjectRepository";
import type { IAuraProject } from "@/core/project/types";

export default function AuthenticatedProjectBoundary({ userId, projects, children }: { userId: string; projects: IAuraProject[]; children: ReactNode }) {
  return <BoundaryInstance key={userId} userId={userId} projects={projects}>{children}</BoundaryInstance>;
}

function BoundaryInstance({ userId, projects, children }: { userId: string; projects: IAuraProject[]; children: ReactNode }) {
  const [configured] = useState(() => {
    authenticatedProjectRepository.configure(userId, projects);
    return true;
  });
  useEffect(() => {
    return () => authenticatedProjectRepository.reset();
  }, []);
  return configured ? children : null;
}
