import type { ReactNode } from "react";
import type { ChatMessage } from "@/types/chat";

interface MessageRendererProps {
  message: ChatMessage;
  children: ReactNode;
}

export function MessageRenderer({
  children,
}: MessageRendererProps) {
  return children;
}