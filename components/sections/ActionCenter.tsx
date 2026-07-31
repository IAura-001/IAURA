"use client";

import type { AuraActionHistoryEntry } from "@/core/actions";
import { useI18n } from "@/core/i18n/I18nContext";

interface ActionCenterProps {
  history: AuraActionHistoryEntry[];
  canUndoLast: boolean;
  onUndoLast: () => void;
}

function formatTime(
  value: string,
  locale: string
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ActionCenter({
  history,
  canUndoLast,
  onUndoLast,
}: ActionCenterProps) {
  const { locale, t } = useI18n();

  if (history.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-emerald-400/15 bg-emerald-500/[0.035] p-6 backdrop-blur-xl lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-emerald-300/60">
            {t("action.eyebrow")}
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            {t("action.title")}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {t("action.subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={onUndoLast}
          disabled={!canUndoLast}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-300/30 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("action.undo")}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {history.slice(0, 5).map((entry) => (
          <article
            key={entry.id}
            className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs",
                  entry.status === "completed"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-zinc-500/10 text-zinc-500",
                ].join(" ")}
              >
                {entry.status === "completed"
                  ? t("action.completed")
                  : t("action.undone")}
              </span>

              <time className="text-xs text-zinc-600">
                {formatTime(
                  entry.createdAt,
                  locale
                )}
              </time>
            </div>

            <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
              {entry.summaries.map((summary) => (
                <li
                  key={summary}
                  className="flex gap-2"
                >
                  <span
                    aria-hidden="true"
                    className="text-emerald-400"
                  >
                    ✓
                  </span>
                  <span>{summary}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {!canUndoLast &&
        history.some(
          (entry) =>
            entry.status === "completed"
        ) && (
          <p className="mt-4 text-xs text-zinc-600">
            {t("action.blocked")}
          </p>
        )}
    </section>
  );
}
