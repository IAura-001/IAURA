"use client";

import { useState } from "react";
import { normalizeThemeDNA } from "@/core/projectTheme/themeDNA";
import type { ProjectMotionPersonality, ProjectThemeDNA } from "@/core/projectTheme/types";
import { sonicEngine, type IauraCandidate, type IauraRole, type PresenceCandidate, type SonicCandidate, type SonicRole } from "@/core/sonic/SonicDNA";

const CANDIDATES: Array<{ id: SonicCandidate; label: string }> = [
  { id: "deep", label: "Deep" }, { id: "crystalline", label: "Crystalline" }, { id: "hybrid", label: "Hybrid" },
];
const ROLES: SonicRole[] = ["tap", "navigation", "select", "open", "close", "apply", "cancel", "completion", "attention"];
const MOTIONS: ProjectMotionPersonality[] = ["calm", "fluid", "dynamic", "precision"];
const IAURA_CANDIDATES: IauraCandidate[] = ["ethereal", "cognitive", "hybrid"];
const IAURA_ROLES: IauraRole[] = ["activation", "acknowledgement", "completion"];
const PRESENCE_CANDIDATES: PresenceCandidate[] = ["vaeora-led", "iaura-led", "balanced"];

export default function SonicLab({ theme }: { theme: ProjectThemeDNA }) {
  const [candidate, setCandidate] = useState<SonicCandidate>("hybrid");
  const [role, setRole] = useState<SonicRole>("tap");
  const [motion, setMotion] = useState<ProjectMotionPersonality>("calm");
  const [iauraRole, setIauraRole] = useState<IauraRole>("activation");
  if (process.env.NODE_ENV === "production") return null;

  const auditionTheme = normalizeThemeDNA({ ...theme, motionStyle: motion });
  const play = (nextCandidate = candidate) => sonicEngine.playAudition(nextCandidate, role, auditionTheme);
  const group = "flex flex-wrap gap-1.5";
  const button = "min-h-9 rounded-full border border-[var(--project-border)] px-3 py-1.5 text-xs text-[var(--project-text-muted)] hover:border-[var(--project-border-strong)] hover:text-[var(--project-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)]";

  return (
    <aside className="mt-4 space-y-4 rounded-2xl border border-dashed border-[var(--project-border)] p-4" aria-label="Development Sonic Lab">
      <div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--project-accent)]">Development only</p><h3 className="mt-1 text-sm text-[var(--project-text)]">Founder Sonic A/B/C</h3><p className="mt-1 text-xs text-[var(--project-text-muted)]">Audition only · never changes production Sonic DNA</p></div>
      <div><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--project-metadata)]">Master signature</p><div className={group}>{CANDIDATES.map((item) => <button key={item.id} type="button" aria-pressed={candidate === item.id} onClick={() => setCandidate(item.id)} className={button}>{item.label}</button>)}</div></div>
      <div><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--project-metadata)]">Role</p><div className={group}>{ROLES.map((item) => <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)} className={button}>{item}</button>)}</div></div>
      <div><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--project-metadata)]">Motion DNA</p><div className={group}>{MOTIONS.map((item) => <button key={item} type="button" aria-pressed={motion === item} onClick={() => setMotion(item)} className={button}>{item}</button>)}</div></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => play()} className="min-h-11 rounded-full bg-[var(--project-action)] px-5 text-sm font-medium text-[var(--project-action-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)]">Play {candidate}</button>
        {CANDIDATES.map((item) => <button key={item.id} type="button" aria-label={`Compare ${role} ${item.label}`} onClick={() => play(item.id)} className={button}>{item.label}</button>)}
      </div>
      <div><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--project-metadata)]">IAURA mark</p><div className={group}>{IAURA_ROLES.map((item) => <button key={item} type="button" aria-pressed={iauraRole === item} onClick={() => setIauraRole(item)} className={button}>{item}</button>)}</div><div className={`${group} mt-2`}>{IAURA_CANDIDATES.map((item) => <button key={item} type="button" onClick={() => sonicEngine.playIaura(iauraRole, auditionTheme, item)} className={button}>IAURA {item}</button>)}</div></div>
      <div><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--project-metadata)]">Presence fusion</p><div className={group}>{PRESENCE_CANDIDATES.map((item) => <button key={item} type="button" onClick={() => sonicEngine.playPresence(auditionTheme, item, false)} className={button}>{item}</button>)}</div><p className="mt-2 text-[11px] text-[var(--project-text-muted)]">Real synchronized preview plays when IAURA is submitted above; these buttons isolate the fusion audio candidates.</p></div>
    </aside>
  );
}
