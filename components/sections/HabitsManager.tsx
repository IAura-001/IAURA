"use client";

import { useState } from "react";
import { useI18n } from "@/core/i18n/I18nContext";

type HabitsManagerProps = {
  habits: string[];
  onAddHabit: (habit: string) => void;
  onRemoveHabit: (habitIndex: number) => void;
};

export default function HabitsManager({
  habits,
  onAddHabit,
  onRemoveHabit,
}: HabitsManagerProps) {
  const [newHabit, setNewHabit] = useState("");
  const { t } = useI18n();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanHabit = newHabit.trim();

    if (!cleanHabit) return;

    onAddHabit(cleanHabit);
    setNewHabit("");
  }

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          {t("habits.eyebrow")}
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          {t("habits.title")}
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          {t("habits.description")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={newHabit}
            onChange={(event) => setNewHabit(event.target.value)}
            placeholder={t("habits.placeholder")}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/50"
          />

          <button
            type="submit"
            className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
          >
            {t("habits.add")}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {habits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-500">
              {t("habits.empty")}
            </p>
          ) : (
            habits.map((habit, index) => (
              <div
                key={`${habit}-${index}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <p className="text-sm text-zinc-200">
                  {habit}
                </p>

                <button
                  type="button"
                  onClick={() => onRemoveHabit(index)}
                  className="shrink-0 text-sm text-zinc-500 transition hover:text-red-400"
                >
                  {t("habits.remove")}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
