"use client";

import { useState } from "react";

type ProfileSettingsProps = {
  userName: string;
  onSaveName: (name: string) => void;
};

export default function ProfileSettings({
  userName,
  onSaveName,
}: ProfileSettingsProps) {
  const [name, setName] = useState(userName);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) return;

    onSaveName(cleanName);
  }

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          USER PROFILE
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Personalize IAURA
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Choose the name IAURA should use when speaking to you.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/50"
          />

          <button
            type="submit"
            className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}