import { memo, type ReactNode } from "react";

interface MessageRendererProps {
  children: ReactNode;
}

function MessageRendererComponent({
  children,
}: MessageRendererProps) {
  return children;
}

export const MessageRenderer = memo(MessageRendererComponent);

MessageRenderer.displayName = "MessageRenderer";