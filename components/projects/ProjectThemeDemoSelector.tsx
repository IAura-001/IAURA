"use client";

import { PROJECT_THEME_PRESETS } from "@/core/projectTheme/themeDNA";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";

import styles from "./ProjectThemeDemoSelector.module.css";

interface ProjectThemeDemoSelectorProps {
  savedTheme: ProjectThemeDNA;
  onPreview: (theme: ProjectThemeDNA | null) => void;
}

export default function ProjectThemeDemoSelector({ savedTheme, onPreview }: ProjectThemeDemoSelectorProps) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <aside className={styles.selector} aria-label="Development theme comparison">
      <div><small>Development preview</small><span>Project worlds</span></div>
      <div className={styles.options}>
        <button type="button" onClick={() => onPreview(null)}>Saved theme</button>
        {Object.values(PROJECT_THEME_PRESETS).map((theme) => (
          <button key={theme.presetId} type="button" onClick={() => onPreview(theme)}>
            {theme.userLabel}
          </button>
        ))}
      </div>
      <span className={styles.current} title={savedTheme.userLabel}>Preview only · never persisted</span>
    </aside>
  );
}
