"use client";

type Mode = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type ModeSelectorProps = {
  modes: Mode[];
  selectedMode: string;
  onSelect: (modeId: string) => void;
};

export default function ModeSelector({
  modes,
  selectedMode,
  onSelect,
}: ModeSelectorProps) {
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2">
      {modes.map((mode) => {
        const selected = selectedMode === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelect(mode.id)}
            className={`rounded-2xl border p-5 text-left transition duration-200 ${
              selected
                ? "border-purple-400/60 bg-purple-500/15 shadow-[0_0_35px_rgba(139,92,246,0.15)]"
                : "border-white/10 bg-white/[0.03] hover:border-purple-400/30 hover:bg-white/[0.05]"
            }`}
          >
            <span className="text-2xl text-purple-300">{mode.icon}</span>

            <h2 className="mt-4 font-semibold">{mode.name}</h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {mode.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}