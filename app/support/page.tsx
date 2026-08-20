import type { Metadata } from "next";
import Link from "next/link";

import SupportCheckoutLink from "@/components/support/SupportCheckoutLink";
import { VAEORA_SUPPORT_URL } from "@/config/support";

import styles from "./support.module.css";

export const metadata: Metadata = {
  title: "Support VAEORA | Back the vision",
  description: "Help sustain the infrastructure and continued development of VAEORA.",
};

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.header}>
          <Link href="/" className={styles.wordmark} aria-label="VAEORA home">
            VAEORA
          </Link>
          <span>Independent intelligence · Beta</span>
        </header>

        <section className={styles.content} aria-labelledby="support-title">
          <p className={styles.eyebrow}>Support VAEORA · Signal 04</p>
          <h1 id="support-title">Back the vision.</h1>
          <p className={styles.lede}>
            Your support helps maintain infrastructure, cover AI usage, continue
            developing VAEORA, and improve the beta with care.
          </p>

          <div className={styles.actionArea}>
            {VAEORA_SUPPORT_URL ? (
              <>
                <SupportCheckoutLink
                  href={VAEORA_SUPPORT_URL}
                  className={styles.checkout}
                />
                <p>Secure checkout hosted by Stripe.</p>
              </>
            ) : (
              <p role="status" className={styles.unavailable}>
                Support checkout is not available in this environment yet.
              </p>
            )}
          </div>

          <p className={styles.note}>
            Support is optional. VAEORA remains focused on building a thoughtful,
            useful intelligence experience.
          </p>
        </section>

        <footer className={styles.footer}>
          <Link href="/iaura">Return to IAURA</Link>
          <Link href="/">Return to VAEORA</Link>
        </footer>
      </div>
    </main>
  );
}
