"use client";

import { useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type AssistantCardProps = {
  modeName?: string;
  modeIcon?: string;
  onStart?: (mission: string) => void;
};

type AuraPhase = "idle" | "awakening" | "ready";

const particles = [
  { left: "14%", top: "22%", delay: "0ms", duration: "1700ms" },
  { left: "82%", top: "18%", delay: "180ms", duration: "2100ms" },
  { left: "24%", top: "72%", delay: "320ms", duration: "1900ms" },
  { left: "76%", top: "68%", delay: "120ms", duration: "2300ms" },
  { left: "48%", top: "12%", delay: "440ms", duration: "1800ms" },
  { left: "10%", top: "50%", delay: "260ms", duration: "2200ms" },
  { left: "90%", top: "48%", delay: "520ms", duration: "2000ms" },
  { left: "50%", top: "84%", delay: "80ms", duration: "2400ms" },
];

export default function AssistantCard({
  modeName = "Aprender",
  modeIcon = "✦",
  onStart,
}: AssistantCardProps) {
  const [mission, setMission] = useState("");
  const [phase, setPhase] = useState<AuraPhase>("idle");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isAwakening = phase === "awakening";
  const isReady = phase === "ready";

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function beginAura() {
    if (isAwakening) return;

    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];

    setPhase("awakening");

    const readyTimer = setTimeout(() => {
      setPhase("ready");
    }, 1900);

    const startTimer = setTimeout(() => {
      onStart?.(mission.trim());
    }, 2600);

    timersRef.current.push(readyTimer, startTimer);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      beginAura();
    }
  }

  function resetAura() {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
    setPhase("idle");
  }

  return (
    <Card
      glow
      className={[
        "relative overflow-hidden p-3 transition-all duration-700",
        isAwakening ? "scale-[1.015]" : "",
      ].join(" ")}
    >
      <div
        className={[
          "aura-panel relative overflow-hidden rounded-[24px] border bg-black/50 p-7 transition-all duration-700 sm:p-10",
          isAwakening
            ? "border-purple-400/40 shadow-[0_0_80px_rgba(139,92,246,0.18)]"
            : "border-purple-400/10",
        ].join(" ")}
      >
        {/* Luz ambiental */}
        <div
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-0 transition-opacity duration-700",
            isAwakening || isReady ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <div className="aura-energy absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-3xl" />

          <div className="aura-ring absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-300/40" />

          <div className="aura-ring aura-ring-delayed absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/20" />

          {particles.map((particle, index) => (
            <span
              key={index}
              className="aura-particle absolute h-1 w-1 rounded-full bg-purple-200 shadow-[0_0_10px_rgba(216,180,254,0.9)]"
              style={{
                left: particle.left,
                top: particle.top,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              }}
            />
          ))}
        </div>

        <div
          className={[
            "relative z-10 transition-all duration-700",
            isAwakening ? "opacity-40 blur-[1px]" : "opacity-100",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs tracking-[0.25em] text-zinc-500">
                ACTIVE MODE
              </p>

              <h2 className="mt-2 text-2xl font-semibold">{modeName}</h2>
            </div>

            <div
              className={[
                "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 text-xl shadow-lg shadow-purple-900/40 transition-all duration-700",
                isAwakening
                  ? "rotate-180 scale-110 shadow-[0_0_35px_rgba(168,85,247,0.65)]"
                  : "",
              ].join(" ")}
            >
              {modeIcon}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-500">Aura</p>

            <p className="mt-3 leading-7 text-zinc-200">
              ¿Qué quieres construir hoy? No necesitas tener todas las
              respuestas. Empezaremos desde donde estás.
            </p>
          </div>

          <div className="mt-4">
            <Input
              placeholder="Escribe tu primera misión..."
              value={mission}
              onChange={(event) => setMission(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAwakening}
            />
          </div>

          <div className="mt-5">
            <Button
  fullWidth
  onClick={beginAura}
  disabled={isAwakening || !mission.trim()}
>
  {isAwakening
    ? "Despertando a Aura..."
    : "Comenzar con Aura →"}
</Button>
          </div>

          <p className="mt-5 text-center text-xs text-zinc-600">
            Aura piensa contigo, no en tu lugar.
          </p>
        </div>

        {/* Núcleo central de la animación */}
        <div
          aria-live="polite"
          className={[
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-all duration-700",
            isAwakening || isReady
              ? "scale-100 opacity-100"
              : "scale-75 opacity-0",
          ].join(" ")}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={[
                "relative flex h-24 w-24 items-center justify-center rounded-full border border-purple-300/30 bg-black/70 backdrop-blur-xl transition-all duration-700",
                isAwakening
                  ? "aura-core shadow-[0_0_60px_rgba(147,51,234,0.6)]"
                  : "shadow-[0_0_35px_rgba(59,130,246,0.4)]",
              ].join(" ")}
            >
              <div className="absolute inset-2 rounded-full border border-blue-400/30" />

              <span className="aura-symbol relative text-3xl text-purple-100">
                ✦
              </span>
            </div>

            <p className="mt-7 text-xs tracking-[0.35em] text-purple-300">
              {isReady ? "CONEXIÓN ESTABLECIDA" : "INICIANDO IAURA"}
            </p>

            <h3 className="mt-3 text-xl font-medium text-white">
              {isReady ? "Aura está lista." : "Aura está despertando..."}
            </h3>

            <p className="mt-2 max-w-xs text-sm text-zinc-400">
              {isReady
                ? "Tu misión comienza ahora."
                : "Preparando memoria, contexto y razonamiento."}
            </p>

            {isReady && (
              <button
                type="button"
                onClick={resetAura}
                className="pointer-events-auto mt-5 text-xs text-zinc-500 transition hover:text-purple-300"
              >
                Volver
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .aura-panel::before {
          content: "";
          position: absolute;
          inset: -1px;
          pointer-events: none;
          background: linear-gradient(
            120deg,
            transparent 20%,
            rgba(168, 85, 247, 0.12),
            transparent 70%
          );
          transform: translateX(-100%);
          animation: aura-scan 5s linear infinite;
        }

        .aura-energy {
          animation: aura-energy 1.8s ease-in-out infinite;
        }

        .aura-core {
          animation: aura-core 1.25s ease-in-out infinite;
        }

        .aura-symbol {
          animation: aura-symbol 1.6s ease-in-out infinite;
        }

        .aura-ring {
          animation: aura-ring 1.8s ease-out infinite;
        }

        .aura-ring-delayed {
          animation-delay: 0.6s;
        }

        .aura-particle {
          animation-name: aura-particle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        @keyframes aura-scan {
          0% {
            transform: translateX(-120%);
          }

          100% {
            transform: translateX(120%);
          }
        }

        @keyframes aura-energy {
          0%,
          100% {
            opacity: 0.35;
            transform: translate(-50%, -50%) scale(0.85);
          }

          50% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1.15);
          }
        }

        @keyframes aura-core {
          0%,
          100% {
            transform: scale(0.96);
          }

          50% {
            transform: scale(1.08);
          }
        }

        @keyframes aura-symbol {
          0%,
          100% {
            opacity: 0.65;
            transform: rotate(0deg) scale(0.9);
          }

          50% {
            opacity: 1;
            transform: rotate(180deg) scale(1.15);
          }
        }

        @keyframes aura-ring {
          0% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(0.45);
          }

          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.45);
          }
        }

        @keyframes aura-particle {
          0%,
          100% {
            opacity: 0.15;
            transform: translateY(8px) scale(0.7);
          }

          50% {
            opacity: 1;
            transform: translateY(-12px) scale(1.4);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-panel::before,
          .aura-energy,
          .aura-core,
          .aura-symbol,
          .aura-ring,
          .aura-particle {
            animation: none;
          }
        }
      `}</style>
    </Card>
  );
}