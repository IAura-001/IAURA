"use client";

import { useState } from "react";

type GoalsManagerProps = {
  goals: string[];
  onAddGoal: (goal: string) => void;
  onRemoveGoal: (goalIndex: number) => void;
};

export default function GoalsManager({
  goals,
  onAddGoal,
  onRemoveGoal,
}: GoalsManagerProps) {
  const [newGoal, setNewGoal] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanGoal = newGoal.trim();

    if (!cleanGoal) return;

    onAddGoal(cleanGoal);
    setNewGoal("");
  }

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          PERSONAL GOALS
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Your Goals
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Define the outcomes you want IAURA to help you achieve.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={newGoal}
            onChange={(event) => setNewGoal(event.target.value)}
            placeholder="Add a new goal"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/50"
          />

          <button
            type="submit"
            className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
          >
            Add Goal
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {goals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-500">
              No goals added yet.
            </p>
          ) : (
            goals.map((goal, index) => (
              <div
                key={`${goal}-${index}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <p className="text-sm text-zinc-200">
                  {goal}
                </p>

                <button
                  type="button"
                  onClick={() => onRemoveGoal(index)}
                  className="shrink-0 text-sm text-zinc-500 transition hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}