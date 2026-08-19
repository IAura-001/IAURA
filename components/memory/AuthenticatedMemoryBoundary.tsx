"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { authenticatedMemoryRepository } from "@/core/memory/AuthenticatedMemoryRepository";
import type { Memory } from "@/types/memory";

interface AuthenticatedMemoryBoundaryProps {
  userId: string;
  memory: Memory | null;
  children: ReactNode;
}

interface MemoryStateResponse {
  exists?: boolean;
  memory?: Memory | null;
}

export default function AuthenticatedMemoryBoundary({
  userId,
  memory,
  children,
}: AuthenticatedMemoryBoundaryProps) {
  if (userId === "unauthenticated") {
    return children;
  }

  return (
    <BoundaryInstance
      key={userId}
      userId={userId}
      memory={memory}
    >
      {children}
    </BoundaryInstance>
  );
}

function BoundaryInstance({
  userId,
  memory,
  children,
}: AuthenticatedMemoryBoundaryProps) {
  const [configured] = useState(() => {
    authenticatedMemoryRepository.configure(
      userId,
      memory,
    );

    return true;
  });

  const [cloudHydrated, setCloudHydrated] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromCloud(): Promise<void> {
      try {
        const response = await fetch(
          "/api/memory-state",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Memory hydration failed (${response.status}).`,
          );
        }

        const body =
          await response.json() as MemoryStateResponse;

        if (
          body.exists &&
          body.memory
        ) {
          authenticatedMemoryRepository.hydrateRemote(
            body.memory,
          );
        }
      } catch (error) {
        console.error(
          "Unable to hydrate authenticated IAURA memory:",
          error,
        );
      } finally {
        if (!cancelled) {
          setCloudHydrated(true);
        }
      }
    }

    void hydrateFromCloud();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return configured && cloudHydrated
    ? children
    : null;
}
