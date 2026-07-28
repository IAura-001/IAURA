export default function Navbar() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between py-8">
      <div>
        <p className="text-lg font-bold tracking-[0.35em] text-white">
          IAURA
        </p>

        <p className="mt-1 text-[10px] tracking-[0.25em] text-zinc-500">
          ENGINEERING INTELLIGENT FUTURES
        </p>
      </div>

      <div className="rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-xs text-purple-300">
        AURA V0.1
      </div>
    </header>
  );
}