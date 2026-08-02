"use client";

import {
  type FormEvent,
  useState,
} from "react";

export default function AccessPage() {
  const [accessKey, setAccessKey] =
    useState("");
  const [isEntering, setIsEntering] =
    useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!accessKey.trim() || isEntering) {
      return;
    }

    setIsEntering(true);
    setError("");

    try {
      const response = await fetch(
        "/api/access",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessKey: accessKey.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("ACCESS_DENIED");
      }

      window.location.assign("/iaura");
    } catch {
      setError(
        "Esa clave no abre este espacio. Inténtalo de nuevo."
      );
      setIsEntering(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#05030a] px-5 py-10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-700/20 blur-[130px]" />
      <div className="pointer-events-none absolute -right-32 top-10 h-72 w-72 rounded-full bg-blue-600/15 blur-[110px]" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-7 shadow-[0_30px_100px_rgba(76,29,149,0.22)] backdrop-blur-2xl sm:p-9">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.34em] text-purple-300/80">
              PRIVATE BETA
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              IAURA
            </h1>
          </div>

          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 via-violet-600 to-blue-500 shadow-[0_0_35px_rgba(139,92,246,0.35)]">
            <span
              aria-hidden="true"
              className="text-xl"
            >
              ✦
            </span>
          </div>
        </div>

        <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <p className="text-xl font-medium leading-snug text-white/95">
          Tu inteligencia personal,
          disponible desde cualquier lugar.
        </p>
        <p className="mt-3 text-sm leading-6 text-white/45">
          Introduce la clave privada para entrar
          a tu espacio.
        </p>

        <form
          className="mt-8"
          onSubmit={handleSubmit}
        >
          <label
            className="text-[10px] font-semibold tracking-[0.25em] text-white/35"
            htmlFor="iaura-access-key"
          >
            CLAVE DE ACCESO
          </label>
          <input
            id="iaura-access-key"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={accessKey}
            onChange={(event) =>
              setAccessKey(event.target.value)
            }
            className="mt-3 h-14 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-white/20 focus:border-purple-400/60 focus:ring-4 focus:ring-purple-500/10"
            placeholder="Tu clave privada"
          />

          <div
            aria-live="polite"
            className="min-h-9 pt-2 text-sm text-rose-300"
          >
            {error}
          </div>

          <button
            type="submit"
            disabled={
              !accessKey.trim() || isEntering
            }
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 text-sm font-semibold shadow-[0_16px_45px_rgba(109,40,217,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEntering
              ? "Abriendo IAURA..."
              : "Entrar a IAURA"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-white/25">
          Acceso protegido · Sesión privada
        </p>
      </section>
    </main>
  );
}
