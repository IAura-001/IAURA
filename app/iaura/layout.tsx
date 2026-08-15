import { VoiceProvider } from "@/core/context/VoiceContext";

import styles from "./layout.module.css";

export default function IauraLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <VoiceProvider>
      <form action="/api/auth/logout" method="post" className={styles.logoutForm}>
        <button type="submit" className={styles.logoutControl}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Cerrar sesión</span>
          <span className={styles.exitMark} aria-hidden="true">↗</span>
        </button>
      </form>
      {children}
    </VoiceProvider>
  );
}
