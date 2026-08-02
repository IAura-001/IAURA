"use client";

import Link from "next/link";

import styles from "./VaeoraLanding.module.css";

export type VaeoraSignal = "presence" | "creation" | "intelligence";

interface VaeoraSignalDockProps {
  activeSignal: VaeoraSignal | null;
  onActiveSignalChange: (signal: VaeoraSignal | null) => void;
}

const SIGNALS: readonly {
  id: VaeoraSignal;
  label: string;
  description: string;
  href: string;
}[] = [
  {
    id: "presence",
    label: "Presence",
    description: "Speak, write, think with Aura.",
    href: "/iaura?view=presence&intent=voice",
  },
  {
    id: "creation",
    label: "Create",
    description: "Shape a complete brand system.",
    href: "/iaura?view=projects&intent=branding",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    description: "Turn memory into direction.",
    href: "/iaura?view=intelligence",
  },
] as const;

function SignalGlyph({ signal }: { signal: VaeoraSignal }) {
  if (signal === "presence") {
    return (
      <span className={styles.presenceGlyph} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    );
  }

  if (signal === "creation") {
    return (
      <span className={styles.creationGlyph} aria-hidden="true">
        <span />
      </span>
    );
  }

  return (
    <span className={styles.intelligenceGlyph} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function VaeoraSignalDock({
  activeSignal,
  onActiveSignalChange,
}: VaeoraSignalDockProps) {
  return (
    <nav className={styles.signalDock} aria-label="Explore VAEORA">
      {SIGNALS.map((signal) => {
        const descriptionId = `vaeora-signal-${signal.id}-description`;
        const active = activeSignal === signal.id;

        return (
          <Link
            key={signal.id}
            href={signal.href}
            className={styles.signalLink}
            data-active={active ? "true" : "false"}
            aria-label={signal.label}
            aria-describedby={descriptionId}
            onPointerEnter={() => onActiveSignalChange(signal.id)}
            onPointerDown={() => onActiveSignalChange(signal.id)}
            onPointerLeave={() => onActiveSignalChange(null)}
            onPointerCancel={() => onActiveSignalChange(null)}
            onFocus={() => onActiveSignalChange(signal.id)}
            onBlur={() => onActiveSignalChange(null)}
          >
            <span className={styles.signalCore}>
              <SignalGlyph signal={signal.id} />
            </span>
            <span className={styles.signalCopy}>
              <span className={styles.signalLabel}>{signal.label}</span>
              <span
                id={descriptionId}
                className={styles.signalDescription}
              >
                {signal.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
