"use client";

import styles from "./WelcomeOverlay.module.css";

interface WelcomeOverlayProps {
  userName: string;
  onContinue: () => void;
}

export default function WelcomeOverlay({
  userName,
  onContinue,
}: WelcomeOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <span className={styles.badge}>
          VAEORA
        </span>

        <h1 className={styles.title}>
          Welcome{userName ? `, ${userName}` : ""}.
        </h1>

        <p className={styles.description}>
          This is your personal intelligence workspace.
          IAURA will help you think, organize, create and
          execute with clarity.
        </p>

        <button
          className={styles.button}
          onClick={onContinue}
        >
          Enter Workspace
        </button>
      </div>
    </div>
  );
}