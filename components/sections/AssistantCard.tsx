import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type AssistantCardProps = {
  modeName?: string;
  modeIcon?: string;
};

export default function AssistantCard({
  modeName = "Aprender",
  modeIcon = "✦",
}: AssistantCardProps) {
  return (
    <Card glow className="p-3">
      <div className="rounded-[24px] border border-purple-400/10 bg-black/50 p-7 sm:p-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">
              ACTIVE MODE
            </p>

            <h2 className="mt-2 text-2xl font-semibold">{modeName}</h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 text-xl shadow-lg shadow-purple-900/40">
            {modeIcon}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-zinc-500">Aura</p>

          <p className="mt-3 leading-7 text-zinc-200">
            ¿Qué quieres construir hoy? No necesitas tener todas las respuestas.
            Empezaremos desde donde estás.
          </p>
        </div>

        <div className="mt-4">
          <Input placeholder="Escribe tu primera misión..." />
        </div>

        <div className="mt-5">
          <Button fullWidth>Comenzar con Aura →</Button>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-600">
          Aura piensa contigo, no en tu lugar.
        </p>
      </div>
    </Card>
  );
}