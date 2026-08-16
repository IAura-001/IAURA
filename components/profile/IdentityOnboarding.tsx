"use client";

import { useState, type FormEvent } from "react";

export default function IdentityOnboarding() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const cleanFirstName = firstName.trim();
    const cleanDisplayName = displayName.trim() || cleanFirstName;
    if (!cleanFirstName) { setError("Escribe tu nombre para continuar."); return; }
    setIsSaving(true); setError("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: cleanFirstName, lastName: lastName.trim(), displayName: cleanDisplayName }) });
      if (!response.ok) { setError("No pudimos guardar tu identidad. Inténtalo de nuevo."); setIsSaving(false); return; }
      window.location.reload();
    } catch {
      setError("No pudimos conectar con IAURA. Inténtalo de nuevo."); setIsSaving(false);
    }
  }

  return <main className="relative grid min-h-screen min-h-svh place-items-center overflow-x-hidden bg-[#030306] px-4 py-[max(1rem,env(safe-area-inset-top))] text-white sm:px-6">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_42%,rgba(103,85,205,0.18),transparent_38%),radial-gradient(ellipse_at_78%_60%,rgba(48,73,153,0.10),transparent_36%)]" aria-hidden="true" />
    <section className="relative w-full max-w-xl rounded-[30px] border border-white/[0.09] bg-[#09090f]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-violet-300/65">Identidad personal</p>
      <h1 className="mt-5 text-4xl font-light tracking-[-0.045em] sm:text-5xl">Antes de comenzar.</h1>
      <p className="mt-4 text-sm font-light leading-7 text-zinc-400 sm:text-base">Aura necesita saber cómo dirigirse a ti.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-xs text-zinc-400">Nombre</span><input autoFocus autoComplete="given-name" required maxLength={80} value={firstName} onChange={(event) => { const value = event.target.value; setFirstName(value); if (!displayNameEdited) setDisplayName(value); }} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none transition focus:border-violet-300/45 focus:ring-2 focus:ring-violet-300/20" /></label>
        <label className="block"><span className="mb-2 block text-xs text-zinc-400">Apellido <span className="text-zinc-600">· opcional</span></span><input autoComplete="family-name" maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none transition focus:border-violet-300/45 focus:ring-2 focus:ring-violet-300/20" /></label>
        <label className="block"><span className="mb-2 block text-xs text-zinc-400">¿Cómo quieres que Aura te llame?</span><input autoComplete="nickname" required maxLength={120} value={displayName} onChange={(event) => { setDisplayNameEdited(true); setDisplayName(event.target.value); }} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none transition focus:border-violet-300/45 focus:ring-2 focus:ring-violet-300/20" /></label>
        {error ? <p role="alert" className="text-sm text-red-200/80">{error}</p> : null}
        <button type="submit" disabled={isSaving || !firstName.trim() || !displayName.trim()} className="min-h-12 w-full rounded-full border border-violet-200/25 bg-violet-500/15 px-5 text-xs font-medium tracking-[0.2em] text-violet-100 transition hover:bg-violet-500/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-40">{isSaving ? "GUARDANDO…" : "CONTINUAR"}</button>
      </form>
    </section>
  </main>;
}
