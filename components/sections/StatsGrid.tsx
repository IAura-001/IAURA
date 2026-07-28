type StatsGridProps = {
  completed: number;
  total: number;
};

export default function StatsGrid({
  completed,
  total,
}: StatsGridProps) {
  const pending = total - completed;

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        title="Completadas"
        value={completed}
        color="text-green-400"
      />

      <StatCard
        title="Pendientes"
        value={pending}
        color="text-yellow-400"
      />

      <StatCard
        title="Total"
        value={total}
        color="text-purple-300"
      />
    </div>
  );
}

type CardProps = {
  title: string;
  value: number;
  color: string;
};

function StatCard({
  title,
  value,
  color,
}: CardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        {title}
      </p>

      <h3 className={`mt-3 text-3xl font-bold ${color}`}>
        {value}
      </h3>
    </div>
  );
}