"use client";

import { PROJECT_THEME_PRESETS } from "@/core/projectTheme/themeDNA";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";
import type { ProjectEnvironmentContext } from "@/core/projectTheme/environmentContext";

import styles from "./ProjectThemeDemoSelector.module.css";

interface ProjectThemeDemoSelectorProps {
  savedTheme: ProjectThemeDNA;
  onPreview: (theme: ProjectThemeDNA | null) => void;
  onContextPreview?: (context: ProjectEnvironmentContext | null) => void;
}

export default function ProjectThemeDemoSelector({ savedTheme, onPreview, onContextPreview }: ProjectThemeDemoSelectorProps) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <aside className={styles.selector} aria-label="Development theme comparison">
      <div><small>Development preview</small><span>Project worlds</span></div>
      <div className={styles.options}>
        <button type="button" onClick={() => onPreview(null)}>VAEORA Original</button>
        {Object.values(PROJECT_THEME_PRESETS).map((theme) => (
          <button key={theme.presetId} type="button" onClick={() => onPreview(theme)}>
            {theme.userLabel}
          </button>
        ))}
      </div>
      {onContextPreview ? <div className={styles.options} aria-label="Living context simulation">
        <button type="button" onClick={() => onContextPreview(null)}>Real context</button>
        {(["idle", "listening", "processing", "speaking", "creating", "reviewing", "completed", "attention"] as const).map((context) => (
          <button key={context} type="button" onClick={() => onContextPreview(context)}>{context}</button>
        ))}
      </div> : null}
      <span className={styles.current} title={savedTheme.userLabel}>Preview only · never persisted</span>
    </aside>
  );
}
