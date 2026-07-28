type DashboardGreetingProps = {
  name: string;
};

export default function DashboardGreeting({
  name,
}: DashboardGreetingProps) {
  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          PERSONAL COMMAND CENTER
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-white">
          {greeting}, {name}.
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Let&apos;s keep building your future, one mission at a time.
        </p>
      </div>
    </div>
  );
}