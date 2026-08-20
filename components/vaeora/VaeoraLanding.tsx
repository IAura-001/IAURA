"use client";

import Link from "next/link";
import { useState } from "react";

import VaeoraPhenomenon from "./VaeoraPhenomenon";
import VaeoraSignalDock, {
  type VaeoraSignal,
} from "./VaeoraSignalDock";
import { VAEORA_SUPPORT_URL } from "@/config/support";
import styles from "./VaeoraLanding.module.css";

export default function VaeoraLanding() {
  const [activeSignal, setActiveSignal] = useState<VaeoraSignal | null>(null);

  return (
    <main className={styles.landing} data-signal={activeSignal ?? "idle"}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.manifestationGlow} aria-hidden="true" />
      <div className={styles.disturbance} aria-hidden="true" />
      <VaeoraPhenomenon activeSignal={activeSignal} />

      <section className={styles.hero} aria-labelledby="vaeora-title">
        <div className={styles.identity}>
          <p className={styles.status}>Coming into focus.</p>
          <h1 id="vaeora-title" className={styles.wordmark}>
            VAEORA
          </h1>
          <p className={styles.tagline}>Where intelligence takes shape.</p>
          <Link className={styles.entry} href="/iaura" aria-label="Enter VAEORA">
            <span>Enter</span>
            <span className={styles.entryLine} aria-hidden="true" />
            <span aria-hidden="true">↗</span>
          </Link>
          {VAEORA_SUPPORT_URL ? (
            <Link className={styles.supportEntry} href="/support">
              Support VAEORA
            </Link>
          ) : null}
        </div>

        <VaeoraSignalDock
          activeSignal={activeSignal}
          onActiveSignalChange={setActiveSignal}
        />
      </section>
    </main>
  );
}
