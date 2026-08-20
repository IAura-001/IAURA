"use client";

import { useState } from "react";

interface SupportCheckoutLinkProps {
  href: string;
  className?: string;
}

export default function SupportCheckoutLink({
  href,
  className,
}: SupportCheckoutLinkProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-busy={isLeaving}
      onClick={() => setIsLeaving(true)}
    >
      <span>{isLeaving ? "Opening secure checkout…" : "Back the vision"}</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
