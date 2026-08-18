"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { authenticatedConversationRepository } from "@/core/conversation/AuthenticatedConversationRepository";
import type { ConversationRepositorySnapshot } from "@/core/conversation/ConversationRepository";

interface AuthenticatedConversationBoundaryProps {
  userId: string;
  snapshot: ConversationRepositorySnapshot | null;
  children: ReactNode;
}

export default function AuthenticatedConversationBoundary({
  userId,
  snapshot,
  children,
}: AuthenticatedConversationBoundaryProps) {
  return (
    <BoundaryInstance
      key={userId}
      userId={userId}
      snapshot={snapshot}
    >
      {children}
    </BoundaryInstance>
  );
}

function BoundaryInstance({
  userId,
  snapshot,
  children,
}: AuthenticatedConversationBoundaryProps) {
  const [configured] = useState(() => {
    authenticatedConversationRepository.configure(
      userId,
      snapshot,
    );

    return true;
  });

  useEffect(() => {
    return () => {
      authenticatedConversationRepository.reset();
    };
  }, []);

  return configured ? children : null;
}