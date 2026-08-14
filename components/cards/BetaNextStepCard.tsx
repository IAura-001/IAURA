import type { BetaNextStepRecommendation } from "@/core/actions";

interface BetaNextStepCardProps {
  recommendation: BetaNextStepRecommendation;
}

const details: Array<{
  key: keyof BetaNextStepRecommendation;
  label: string;
}> = [
  { key: "action", label: "Acción" },
  { key: "whyNow", label: "Por qué ahora" },
  { key: "result", label: "Resultado esperado" },
  { key: "doneWhen", label: "Terminado cuando" },
];

export function BetaNextStepCard({
  recommendation,
}: BetaNextStepCardProps) {
  return (
    <section
      aria-label="Siguiente paso recomendado"
      className="mt-5 overflow-hidden rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/[0.09] to-blue-500/[0.04]"
    >
      <header className="border-b border-white/[0.07] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">
          Siguiente paso recomendado
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Una propuesta de Aura para avanzar ahora
        </p>
      </header>

      <dl className="divide-y divide-white/[0.07]">
        {details.map(({ key, label }) => (
          <div key={key} className="px-5 py-4">
            <dt className="text-xs font-medium text-zinc-500">{label}</dt>
            <dd className="mt-1.5 whitespace-pre-wrap leading-6 text-zinc-200">
              {recommendation[key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
