interface BrandIdentityCardProps {
  name: string;
  slogan: string;
  mission: string;
  colors: string[];
  font: string;
}

export function BrandIdentityCard({
  name,
  slogan,
  mission,
  colors,
  font,
}: BrandIdentityCardProps) {
 
    return (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{name}</h2>
        <p className="text-zinc-400">{slogan}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase text-zinc-500">
          Mission
        </h3>

        <p className="mt-1 text-sm text-zinc-300">
          {mission}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase text-zinc-500">
          Colors
        </h3>

        <div className="mt-2 flex gap-2">
          {colors.map((color) => (
            <div
              key={color}
              className="h-8 w-8 rounded-full border border-zinc-700"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase text-zinc-500">
          Font
        </h3>

        <p className="mt-1 text-sm">{font}</p>
      </div>

      <button className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-medium transition hover:bg-blue-500">
        Continue
      </button>
    </div>
  </div>
);
}