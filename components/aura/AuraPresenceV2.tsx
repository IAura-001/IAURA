"use client";

const PARTICLE_COUNT = 70;

function getParticle(index: number) {
  const angle = index * 2.399963;
  const radius = 18 + ((index * 37) % 120);

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.58,
    size: 1 + ((index * 13) % 4),
    delay: -((index * 0.19) % 8),
    duration: 5 + ((index * 17) % 7),
    driftX: -24 + ((index * 29) % 48),
    driftY: -18 + ((index * 31) % 36),
    opacity: 0.25 + ((index * 11) % 60) / 100,
  };
}

export default function AuraPresenceV2() {
  const particles = Array.from(
    { length: PARTICLE_COUNT },
    (_, index) => getParticle(index),
  );

  return (
    <section className="aura-v2 relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black">
      <div className="aura-field absolute inset-0" />

      <div
        className="aura-presence-zone relative h-[420px] w-[420px]"
        aria-hidden="true"
      >
        <div className="aura-energy absolute inset-[20%]" />

        {particles.map((particle, index) => (
          <span
            key={index}
            className="aura-particle absolute left-1/2 top-1/2 rounded-full"
            style={
              {
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                opacity: particle.opacity,
                "--x": `${particle.x}px`,
                "--y": `${particle.y}px`,
                "--drift-x": `${particle.driftX}px`,
                "--drift-y": `${particle.driftY}px`,
                "--delay": `${particle.delay}s`,
                "--duration": `${particle.duration}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <style jsx>{`
        .aura-v2 {
          isolation: isolate;
        }

        .aura-field {
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(109, 40, 217, 0.1),
              transparent 28%
            ),
            radial-gradient(
              circle at 44% 56%,
              rgba(59, 130, 246, 0.04),
              transparent 42%
            );
        }

        .aura-presence-zone {
          filter: saturate(1.15);
          animation: presence-breathe 7s ease-in-out infinite;
        }

        .aura-energy {
          border-radius: 45% 55% 58% 42%;
          background:
            radial-gradient(
              circle at 42% 44%,
              rgba(255, 255, 255, 0.72),
              rgba(196, 181, 253, 0.28) 9%,
              rgba(124, 58, 237, 0.13) 34%,
              transparent 68%
            );
          filter: blur(22px);
          animation:
            energy-morph 9s ease-in-out infinite alternate,
            energy-drift 13s ease-in-out infinite;
        }

        .aura-particle {
          background: rgba(221, 214, 254, 0.95);
          box-shadow:
            0 0 8px rgba(196, 181, 253, 0.9),
            0 0 20px rgba(124, 58, 237, 0.55);
          transform: translate(
            calc(-50% + var(--x)),
            calc(-50% + var(--y))
          );
          animation: particle-life var(--duration) ease-in-out
            var(--delay) infinite;
        }

        @keyframes particle-life {
          0%,
          100% {
            transform: translate(
                calc(-50% + var(--x)),
                calc(-50% + var(--y))
              )
              scale(0.45);
            opacity: 0.08;
          }

          45% {
            transform: translate(
                calc(-50% + var(--x) + var(--drift-x)),
                calc(-50% + var(--y) + var(--drift-y))
              )
              scale(1.35);
            opacity: 0.95;
          }

          70% {
            transform: translate(
                calc(-50% + var(--x) - var(--drift-x)),
                calc(-50% + var(--y) - var(--drift-y))
              )
              scale(0.8);
            opacity: 0.35;
          }
        }

        @keyframes energy-morph {
          0% {
            border-radius: 45% 55% 58% 42%;
            transform: scale(0.82) rotate(-8deg);
          }

          50% {
            border-radius: 58% 42% 46% 54%;
            transform: scale(1.08) rotate(9deg);
          }

          100% {
            border-radius: 40% 60% 55% 45%;
            transform: scale(0.93) rotate(-3deg);
          }
        }

        @keyframes energy-drift {
          0%,
          100% {
            translate: -12px 6px;
          }

          50% {
            translate: 15px -10px;
          }
        }

        @keyframes presence-breathe {
          0%,
          100% {
            transform: scale(0.94);
            opacity: 0.74;
          }

          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-presence-zone,
          .aura-energy,
          .aura-particle {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}