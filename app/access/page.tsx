"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import styles from "./access.module.css";

export default function AccessPage() {
  const [accessKey, setAccessKey] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecognized, setIsRecognized] = useState(false);
  const [error, setError] = useState("");

  const presenceState = isRecognized
    ? "recognized"
    : isEntering
      ? "listening"
      : error
        ? "unrecognized"
        : isFocused || accessKey
          ? "engaged"
          : "idle";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessKey.trim() || isEntering) return;

    setIsEntering(true);
    setError("");

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: accessKey.trim() }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const waitMinutes = Number.isFinite(retryAfter)
            ? Math.max(1, Math.ceil(retryAfter / 60))
            : null;
          setError(
            waitMinutes
              ? `Demasiados intentos. Espera ${waitMinutes} min antes de volver a probar.`
              : "Demasiados intentos. Espera un momento antes de volver a probar.",
          );
        } else if (response.status === 503) {
          setError("El acceso privado todavía no está configurado en este entorno.");
        } else {
          setError("Esa clave no abre este espacio. Inténtalo de nuevo.");
        }
        setIsEntering(false);
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const isSafeIauraPath = Boolean(
        requestedPath === "/iaura" ||
          requestedPath?.startsWith("/iaura?") ||
          requestedPath?.startsWith("/iaura/"),
      );
      const nextPath = requestedPath && isSafeIauraPath ? requestedPath : "/iaura";

      setIsRecognized(true);
      const prefersReducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.setTimeout(
        () => window.location.assign(nextPath),
        prefersReducedMotion ? 0 : 760,
      );
    } catch {
      setError("No se pudo contactar a IAURA. Revisa la conexión e inténtalo otra vez.");
      setIsEntering(false);
    }
  }

  return (
    <main className={styles.gateway} data-presence={presenceState}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <div className={styles.horizon} aria-hidden="true" />

      <div className={styles.frame}>
        <header className={styles.brandRow}>
          <Link className={styles.wordmark} href="/" aria-label="IAURA, inicio">
            IAURA
          </Link>
          <span className={styles.privateSignal}>
            <span aria-hidden="true" />
            Private beta · Access 01
          </span>
        </header>

        <section className={styles.threshold} aria-labelledby="access-title">
          <div className={styles.presence} aria-hidden="true">
            <div className={styles.presenceField} />
            <div className={styles.orbitOuter} />
            <div className={styles.orbitInner} />
            <div className={styles.presenceAxis} />
            <div className={styles.presenceCore}><span /></div>
          </div>

          <div className={styles.invitation}>
            <p className={styles.eyebrow}>Personal intelligence · by invitation</p>
            <h1 id="access-title" className={styles.title}>
              Lo que sigue
              <span>solo se revela al entrar.</span>
            </h1>
            <p className={styles.intro}>
              IAURA reconoce una señal privada. Si la tienes, el espacio es tuyo.
            </p>
          </div>

          <div className={styles.accessPanel}>
            <p className={styles.panelSignal}>
              <span aria-hidden="true">01</span>
              Umbral privado
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.label} htmlFor="iaura-access-key">
                CLAVE DE ACCESO
              </label>

              <div className={styles.keyField}>
                <input
                  id="iaura-access-key"
                  type="password"
                  autoComplete="current-password"
                  value={accessKey}
                  disabled={isEntering}
                  aria-describedby="iaura-access-message"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onChange={(event) => {
                    setAccessKey(event.target.value);
                    if (error) setError("");
                  }}
                  className={styles.input}
                  placeholder="Introduce tu señal"
                />
                <span className={styles.fieldTrace} aria-hidden="true" />
                <span className={styles.keyStatus} aria-hidden="true">
                  {accessKey ? "SIGNAL RECEIVED" : "AWAITING SIGNAL"}
                </span>
              </div>

              <div
                id="iaura-access-message"
                role={error ? "alert" : "status"}
                aria-live="polite"
                className={styles.message}
              >
                {isRecognized ? "Señal reconocida. Abriendo el umbral." : error}
              </div>

              <button
                type="submit"
                disabled={!accessKey.trim() || isEntering}
                aria-busy={isEntering}
                data-state={isEntering ? "loading" : error ? "error" : "idle"}
                className={styles.enterButton}
              >
                <span>
                  {isRecognized
                    ? "Señal reconocida"
                    : isEntering
                      ? "Abriendo IAURA..."
                      : "Entrar a IAURA"}
                </span>
                <span className={styles.buttonLine} aria-hidden="true" />
                <svg
                  className={styles.buttonArrow}
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path d="M3 13 13 3M6 3h7v7" />
                </svg>
              </button>
            </form>

            <p className={styles.discretion}>Acceso reservado · Sesión privada</p>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>IAURA / Private intelligence system</span>
          <span aria-hidden="true">Presence detected</span>
        </footer>
      </div>
    </main>
  );
}
