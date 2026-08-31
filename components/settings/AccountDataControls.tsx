"use client";
import { useState } from "react";

export default function AccountDataControls() {
  const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function deleteAccount() {
    if (confirmation !== "DELETE MY ACCOUNT" || busy) return;
    setBusy(true); setError("");
    const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }) }).catch(() => null);
    if (!response?.ok) { setError("Account deletion could not be completed. Your account remains available; retry or contact support."); setBusy(false); return; }
    window.location.assign("/");
  }
  return <section className="rounded-2xl border border-red-300/20 bg-red-400/[0.04] p-5" aria-labelledby="delete-account-title">
    <h2 id="delete-account-title" className="text-lg font-semibold text-red-100">Delete account</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-400">Permanently deletes your profile, projects, conversations, memory, intelligence records, analytics linkage, usage rows, and cloud assets. This cannot be undone.</p>
    <label className="mt-4 block text-sm text-zinc-300" htmlFor="delete-confirmation">Type DELETE MY ACCOUNT to confirm</label>
    <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
      className="mt-2 min-h-11 w-full rounded-xl border border-red-300/20 bg-black/30 px-3 text-white" />
    {error ? <p className="mt-2 text-sm text-red-300" role="alert">{error}</p> : null}
    <button type="button" onClick={() => void deleteAccount()} disabled={confirmation !== "DELETE MY ACCOUNT" || busy}
      className="mt-4 min-h-11 rounded-xl border border-red-300/30 px-4 text-sm text-red-100 disabled:opacity-40">
      {busy ? "Deleting account…" : "Permanently delete account"}
    </button>
  </section>;
}
