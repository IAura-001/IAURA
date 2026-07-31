"use client";

import { useVoiceContext } from "@/core/context/VoiceContext";
import { useI18n } from "@/core/i18n/I18nContext";
import type { MessageKey } from "@/core/i18n/messages";

type AuraPhase = "idle" | "awakening";

interface AuraPresenceProps {
  phase: AuraPhase;
}

const particles = [
  ["8%", "22%", "0ms", "3.4s"],
  ["18%", "74%", "420ms", "4.2s"],
  ["29%", "12%", "700ms", "3.8s"],
  ["34%", "88%", "160ms", "4.5s"],
  ["48%", "6%", "880ms", "3.6s"],
  ["55%", "92%", "520ms", "4.1s"],
  ["68%", "14%", "240ms", "4.4s"],
  ["76%", "82%", "960ms", "3.7s"],
  ["88%", "28%", "620ms", "4.6s"],
  ["92%", "62%", "120ms", "3.9s"],
  ["12%", "48%", "1040ms", "4.3s"],
  ["84%", "50%", "360ms", "3.5s"],
] as const;

const waveHeights = [
  18, 32, 24, 44, 30, 52, 36, 58, 40, 50,
  28, 46, 22, 38, 20,
];

export function AuraPresence({
  phase,
}: AuraPresenceProps) {
  const { state } = useVoiceContext();
  const { t } = useI18n();
  const visualState =
    phase === "awakening"
      ? "awakening"
      : state;
  const statusKey =
    `aura.state.${visualState}` as MessageKey;

  return (
    <div
      className={`aura-presence aura-${visualState} relative mx-auto flex min-h-[268px] w-full max-w-[440px] items-center justify-center overflow-hidden sm:min-h-[310px]`}
      aria-label={t(statusKey)}
    >
      <div
        aria-hidden="true"
        className="aura-nebula absolute inset-[12%] rounded-full"
      />

      <div
        aria-hidden="true"
        className="aura-grid absolute inset-0"
      />

      {particles.map(
        ([left, top, delay, duration], index) => (
          <span
            key={`${left}-${top}`}
            aria-hidden="true"
            className="aura-star absolute rounded-full"
            style={{
              left,
              top,
              animationDelay: delay,
              animationDuration: duration,
            }}
          >
            {index % 3 === 0 ? "✦" : ""}
          </span>
        )
      )}

      <div
        aria-hidden="true"
        className="aura-orbit aura-orbit-one absolute left-1/2 top-1/2 h-[214px] w-[214px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      >
        <span />
      </div>

      <div
        aria-hidden="true"
        className="aura-orbit aura-orbit-two absolute left-1/2 top-1/2 h-[256px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
      >
        <span />
      </div>

      <div
        aria-hidden="true"
        className="aura-orbit aura-orbit-three absolute left-1/2 top-1/2 h-[168px] w-[278px] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
      >
        <span />
      </div>

      <div className="aura-core-shell relative z-10 flex h-32 w-32 items-center justify-center rounded-full sm:h-36 sm:w-36">
        <div
          aria-hidden="true"
          className="aura-core-atmosphere absolute -inset-10 rounded-full"
        />

        <div
          aria-hidden="true"
          className="aura-core-glass absolute inset-0 rounded-full"
        />

        <div
          aria-hidden="true"
          className="aura-core-flow absolute inset-3 rounded-full"
        />

        <div
          aria-hidden="true"
          className="aura-core-inner absolute inset-9 rounded-full"
        />

        <span className="aura-glyph relative z-20 text-4xl font-light">
          ✦
        </span>
      </div>

      <div
        aria-hidden="true"
        className="aura-wave absolute bottom-9 left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-[3px] sm:bottom-10 sm:h-14"
      >
        {waveHeights.map((height, index) => (
          <span
            key={`${height}-${index}`}
            style={{
              height: `${height}%`,
              animationDelay: `${index * 55}ms`,
            }}
          />
        ))}
      </div>

      <div className="absolute bottom-0 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[9px] font-medium uppercase tracking-[0.26em] text-violet-200 backdrop-blur-xl sm:bottom-1 sm:text-[10px] sm:tracking-[0.28em]">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
        {t(statusKey)}
      </div>

      <style jsx>{`
        .aura-presence {
          --aura-primary: 168, 85, 247;
          --aura-secondary: 59, 130, 246;
          --aura-accent: 216, 180, 254;
          isolation: isolate;
        }

        .aura-listening {
          --aura-primary: 34, 211, 238;
          --aura-secondary: 59, 130, 246;
          --aura-accent: 165, 243, 252;
        }

        .aura-processing {
          --aura-primary: 245, 158, 11;
          --aura-secondary: 168, 85, 247;
          --aura-accent: 253, 230, 138;
        }

        .aura-speaking {
          --aura-primary: 236, 72, 153;
          --aura-secondary: 139, 92, 246;
          --aura-accent: 251, 207, 232;
        }

        .aura-awakening {
          --aura-primary: 192, 132, 252;
          --aura-secondary: 56, 189, 248;
          --aura-accent: 255, 255, 255;
        }

        .aura-nebula {
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(var(--aura-primary), 0.28),
              transparent 34%
            ),
            radial-gradient(
              circle at 28% 40%,
              rgba(var(--aura-secondary), 0.18),
              transparent 32%
            ),
            radial-gradient(
              circle at 76% 62%,
              rgba(var(--aura-primary), 0.14),
              transparent 30%
            );
          filter: blur(22px);
          animation: aura-nebula 8s ease-in-out
            infinite alternate;
        }

        .aura-grid {
          opacity: 0.12;
          mask-image: radial-gradient(
            circle,
            black,
            transparent 68%
          );
          background-image:
            linear-gradient(
              rgba(var(--aura-primary), 0.16)
                1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(var(--aura-secondary), 0.12)
                1px,
              transparent 1px
            );
          background-size: 26px 26px;
          transform: perspective(320px)
            rotateX(62deg) scale(1.25);
          animation: aura-grid 12s linear infinite;
        }

        .aura-star {
          width: 3px;
          height: 3px;
          color: rgba(var(--aura-accent), 0.9);
          background: currentColor;
          box-shadow: 0 0 12px currentColor;
          font-size: 9px;
          line-height: 1;
          animation: aura-star ease-in-out infinite;
        }

        .aura-star:nth-of-type(3n) {
          width: auto;
          height: auto;
          background: transparent;
          box-shadow: none;
        }

        .aura-orbit {
          border: 1px solid
            rgba(var(--aura-primary), 0.22);
          box-shadow:
            inset 0 0 24px
              rgba(var(--aura-secondary), 0.04),
            0 0 18px
              rgba(var(--aura-primary), 0.06);
        }

        .aura-orbit span {
          position: absolute;
          top: -4px;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgb(var(--aura-accent));
          box-shadow:
            0 0 12px
              rgba(var(--aura-accent), 0.95),
            0 0 28px
              rgba(var(--aura-primary), 0.8);
        }

        .aura-orbit-one {
          animation: aura-orbit-one 10s linear
            infinite;
        }

        .aura-orbit-two {
          transform: translate(-50%, -50%)
            rotate(58deg);
          animation: aura-orbit-two 13s linear
            infinite reverse;
        }

        .aura-orbit-three {
          transform: translate(-50%, -50%)
            rotate(-24deg);
          animation: aura-orbit-three 16s linear
            infinite;
        }

        .aura-core-shell {
          border: 1px solid
            rgba(var(--aura-accent), 0.25);
          background: rgba(3, 2, 12, 0.72);
          box-shadow:
            0 0 20px
              rgba(var(--aura-primary), 0.28),
            0 0 70px
              rgba(var(--aura-secondary), 0.22),
            inset 0 0 36px
              rgba(var(--aura-primary), 0.16);
          backdrop-filter: blur(16px);
          animation: aura-breathe 4.2s ease-in-out
            infinite;
        }

        .aura-core-atmosphere {
          background: conic-gradient(
            from 0deg,
            transparent,
            rgba(var(--aura-primary), 0.45),
            transparent,
            rgba(var(--aura-secondary), 0.36),
            transparent
          );
          filter: blur(18px);
          animation: aura-spin 8s linear infinite;
        }

        .aura-core-glass {
          overflow: hidden;
          background:
            radial-gradient(
              circle at 34% 28%,
              rgba(255, 255, 255, 0.2),
              transparent 24%
            ),
            radial-gradient(
              circle at 50% 66%,
              rgba(var(--aura-primary), 0.32),
              transparent 55%
            );
        }

        .aura-core-flow {
          background: conic-gradient(
            from 120deg,
            rgba(var(--aura-primary), 0.12),
            rgba(var(--aura-secondary), 0.72),
            rgba(var(--aura-accent), 0.16),
            rgba(var(--aura-primary), 0.7),
            rgba(var(--aura-primary), 0.12)
          );
          filter: blur(5px);
          animation: aura-spin 5.5s linear infinite
            reverse;
        }

        .aura-core-inner {
          background: radial-gradient(
            circle at 38% 32%,
            white,
            rgb(var(--aura-accent)) 10%,
            rgb(var(--aura-primary)) 42%,
            rgba(var(--aura-secondary), 0.35)
              70%,
            transparent
          );
          box-shadow:
            0 0 22px
              rgba(var(--aura-primary), 0.8),
            0 0 48px
              rgba(var(--aura-secondary), 0.5);
          animation: aura-core 2.8s ease-in-out
            infinite;
        }

        .aura-glyph {
          color: rgb(var(--aura-accent));
          text-shadow:
            0 0 10px currentColor,
            0 0 28px
              rgba(var(--aura-primary), 0.9);
          animation: aura-glyph 3.6s ease-in-out
            infinite;
        }

        .aura-wave span {
          display: block;
          width: 3px;
          min-height: 4px;
          border-radius: 999px;
          background: linear-gradient(
            to top,
            rgba(var(--aura-secondary), 0.35),
            rgb(var(--aura-accent))
          );
          box-shadow: 0 0 8px
            rgba(var(--aura-primary), 0.6);
          opacity: 0.34;
          animation: aura-wave 1.8s ease-in-out
            infinite;
        }

        .aura-listening .aura-wave span,
        .aura-speaking .aura-wave span,
        .aura-processing .aura-wave span,
        .aura-awakening .aura-wave span {
          opacity: 0.95;
          animation-duration: 720ms;
        }

        .aura-listening .aura-core-shell,
        .aura-speaking .aura-core-shell,
        .aura-awakening .aura-core-shell {
          animation-duration: 1.2s;
        }

        @keyframes aura-nebula {
          from {
            opacity: 0.58;
            transform: scale(0.88) rotate(-4deg);
          }
          to {
            opacity: 1;
            transform: scale(1.08) rotate(5deg);
          }
        }

        @keyframes aura-grid {
          to {
            background-position: 26px 26px;
          }
        }

        @keyframes aura-star {
          0%,
          100% {
            opacity: 0.18;
            transform: translateY(5px)
              scale(0.7);
          }
          50% {
            opacity: 1;
            transform: translateY(-8px)
              scale(1.4);
          }
        }

        @keyframes aura-orbit-one {
          to {
            transform: translate(-50%, -50%)
              rotate(360deg);
          }
        }

        @keyframes aura-orbit-two {
          to {
            transform: translate(-50%, -50%)
              rotate(418deg);
          }
        }

        @keyframes aura-orbit-three {
          to {
            transform: translate(-50%, -50%)
              rotate(336deg);
          }
        }

        @keyframes aura-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes aura-breathe {
          0%,
          100% {
            transform: scale(0.96);
          }
          50% {
            transform: scale(1.04);
          }
        }

        @keyframes aura-core {
          0%,
          100% {
            opacity: 0.72;
            transform: scale(0.86);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @keyframes aura-glyph {
          0%,
          100% {
            opacity: 0.72;
            transform: rotate(0deg) scale(0.92);
          }
          50% {
            opacity: 1;
            transform: rotate(180deg) scale(1.16);
          }
        }

        @keyframes aura-wave {
          0%,
          100% {
            transform: scaleY(0.32);
          }
          50% {
            transform: scaleY(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-nebula,
          .aura-grid,
          .aura-star,
          .aura-orbit-one,
          .aura-orbit-two,
          .aura-orbit-three,
          .aura-core-shell,
          .aura-core-atmosphere,
          .aura-core-flow,
          .aura-core-inner,
          .aura-glyph,
          .aura-wave span {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
