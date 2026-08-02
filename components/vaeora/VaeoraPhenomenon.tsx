"use client";

import { useEffect, useRef } from "react";

import type { VaeoraSignal } from "./VaeoraSignalDock";
import styles from "./VaeoraLanding.module.css";

const TAU = Math.PI * 2;
const RIBBON_COUNT = 4;
const BRANCH_COUNT = 9;
const RIBBON_POINT_COUNT = 43;

interface SignalProfile {
  intensity: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  ribbonBoost: number;
  branchBoost: number;
  hueShift: number;
}

const SIGNAL_PROFILES: Record<VaeoraSignal | "idle", SignalProfile> = {
  presence: {
    intensity: 1,
    offsetX: -0.006,
    offsetY: -0.014,
    rotation: -0.012,
    ribbonBoost: 0.035,
    branchBoost: 0.04,
    hueShift: -3,
  },
  creation: {
    intensity: 1,
    offsetX: -0.012,
    offsetY: 0.006,
    rotation: 0.016,
    ribbonBoost: 0.085,
    branchBoost: 0.025,
    hueShift: 4,
  },
  intelligence: {
    intensity: 1,
    offsetX: 0.008,
    offsetY: 0.012,
    rotation: 0.006,
    ribbonBoost: 0.02,
    branchBoost: 0.16,
    hueShift: 8,
  },
  idle: {
    intensity: 0,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    ribbonBoost: 0,
    branchBoost: 0,
    hueShift: 0,
  },
};

const RIBBON_CONFIGS = Array.from({ length: RIBBON_COUNT }, (_, ribbon) => ({
  seed: Math.sin((ribbon + 1) * 73.19) * 0.5 + 0.5,
  secondarySeed: Math.cos((ribbon + 1) * 41.73) * 0.5 + 0.5,
  baseHue: 228 + ribbon * 6,
  baseOpacity: 0.034 + ribbon * 0.007,
  rotation: -0.18 + ribbon * 0.105,
}));

const BRANCH_CONFIGS = Array.from({ length: BRANCH_COUNT }, (_, branch) => ({
  seed: Math.sin((branch + 1) * 57.31) * 0.5 + 0.5,
  secondarySeed: Math.cos((branch + 1) * 83.17) * 0.5 + 0.5,
  direction: branch % 3 === 0 ? -1 : 1,
  baseHue: 228 + (branch % 5) * 6,
  baseOpacity: 0.07 + (branch % 4) * 0.018,
}));

const POINT_PROGRESS = Float32Array.from(
  { length: RIBBON_POINT_COUNT },
  (_, point) => point / (RIBBON_POINT_COUNT - 1),
);
const POINT_POSITION = Float32Array.from(
  POINT_PROGRESS,
  (progress) => progress * 2 - 1,
);
const POINT_ENVELOPE = Float32Array.from(POINT_PROGRESS, (progress) =>
  Math.pow(Math.sin(progress * Math.PI), 1.25),
);

interface RibbonPalette {
  fill: readonly [string, string, string, string, string];
  edge: readonly [string, string, string, string];
  shadow: string;
}

interface BranchPalette {
  colors: readonly [string, string, string];
}

const ribbonPaletteCache = new Map<string, RibbonPalette>();
const branchPaletteCache = new Map<string, BranchPalette>();

function getRibbonPalette(
  hue: number,
  ribbon: number,
  baseOpacity: number,
): RibbonPalette {
  const key = `${hue}:${ribbon}`;
  const cached = ribbonPaletteCache.get(key);
  if (cached) return cached;

  const palette: RibbonPalette = {
    fill: [
      `hsla(${hue}, 96%, 68%, 0)`,
      `hsla(${hue}, 96%, 69%, ${baseOpacity * 0.34})`,
      `hsla(${hue}, 98%, 73%, ${baseOpacity})`,
      `hsla(${hue}, 96%, 68%, ${baseOpacity * 0.24})`,
      `hsla(${hue}, 96%, 68%, 0)`,
    ],
    edge: [
      `hsla(${hue}, 100%, 78%, 0)`,
      `hsla(${hue}, 100%, 78%, 0.08)`,
      `hsla(${hue}, 100%, 82%, 0.17)`,
      `hsla(${hue}, 100%, 78%, 0)`,
    ],
    shadow: `hsla(${hue}, 100%, 66%, ${ribbon < 2 ? 0.3 : 0})`,
  };
  ribbonPaletteCache.set(key, palette);
  return palette;
}

function getBranchPalette(
  hue: number,
  branch: number,
  baseOpacity: number,
): BranchPalette {
  const key = `${hue}:${branch}`;
  const cached = branchPaletteCache.get(key);
  if (cached) return cached;

  const palette: BranchPalette = {
    colors: [
      `hsla(${hue}, 100%, 79%, ${baseOpacity * 0.72})`,
      `hsla(${hue}, 100%, 75%, ${baseOpacity})`,
      `hsla(${hue}, 100%, 72%, 0)`,
    ],
  };
  branchPaletteCache.set(key, palette);
  return palette;
}

interface VaeoraPhenomenonProps {
  activeSignal: VaeoraSignal | null;
}

export default function VaeoraPhenomenon({
  activeSignal,
}: VaeoraPhenomenonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSignalRef = useRef<VaeoraSignal | null>(activeSignal);

  useEffect(() => {
    activeSignalRef.current = activeSignal;
  }, [activeSignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!canvas || !context) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let reducedMotion = reducedMotionQuery.matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastDraw = 0;
    let qualityScale = 1;
    let slowFrameCount = 0;
    let fastFrameCount = 0;
    let targetPixelRatio = 1;
    let signalIntensity = 0;
    let signalOffsetX = 0;
    let signalOffsetY = 0;
    let signalRotation = 0;
    let signalRibbonBoost = 0;
    let signalBranchBoost = 0;
    let signalHueShift = 0;
    const startedAt = performance.now();
    const pointX = new Float32Array(RIBBON_POINT_COUNT);
    const pointY = new Float32Array(RIBBON_POINT_COUNT);
    const pointWidth = new Float32Array(RIBBON_POINT_COUNT);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const isMobile = window.innerWidth < 700;
      width = bounds.width;
      height = bounds.height;
      const pixelBudget = isMobile ? 3_500_000 : 8_294_400;
      targetPixelRatio = Math.min(
        window.devicePixelRatio || 1,
        3,
        Math.sqrt(pixelBudget / Math.max(1, width * height)),
      );
      const minimumPixelRatio = isMobile ? 0.85 : 0.7;
      const pixelRatio = Math.max(
        minimumPixelRatio,
        targetPixelRatio * qualityScale,
      );
      const backingWidth = Math.round(width * pixelRatio);
      const backingHeight = Math.round(height * pixelRatio);

      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    };

    const draw = (now: number) => {
      const frameDelta = lastDraw === 0 ? 16.7 : now - lastDraw;
      lastDraw = now;

      const elapsed = reducedMotion ? 8 : (now - startedAt) / 1000;

      if (!reducedMotion && elapsed > 3 && targetPixelRatio > 1) {
        if (frameDelta > 20) {
          slowFrameCount += 1;
          fastFrameCount = 0;
        } else if (frameDelta < 17) {
          fastFrameCount += 1;
          slowFrameCount = Math.max(0, slowFrameCount - 2);
        } else {
          slowFrameCount = Math.max(0, slowFrameCount - 1);
          fastFrameCount = 0;
        }

        if (slowFrameCount >= 24 && qualityScale > 0.65) {
          qualityScale = Math.max(0.65, qualityScale - 0.15);
          slowFrameCount = 0;
          fastFrameCount = 0;
          resize();
        } else if (fastFrameCount >= 300 && qualityScale < 1) {
          qualityScale = Math.min(1, qualityScale + 0.15);
          slowFrameCount = 0;
          fastFrameCount = 0;
          resize();
        }
      }

      const signal = reducedMotion ? null : activeSignalRef.current;
      const profile = SIGNAL_PROFILES[signal ?? "idle"];
      const response = 1 - Math.exp(-frameDelta / 180);

      signalIntensity += (profile.intensity - signalIntensity) * response;
      signalOffsetX += (profile.offsetX - signalOffsetX) * response;
      signalOffsetY += (profile.offsetY - signalOffsetY) * response;
      signalRotation += (profile.rotation - signalRotation) * response;
      signalRibbonBoost +=
        (profile.ribbonBoost - signalRibbonBoost) * response;
      signalBranchBoost +=
        (profile.branchBoost - signalBranchBoost) * response;
      signalHueShift += (profile.hueShift - signalHueShift) * response;

      context.clearRect(0, 0, width, height);

      const formationProgress = reducedMotion
        ? 0.86
        : Math.min(1, Math.max(0, elapsed / 2.25));
      const formation = 1 - Math.pow(1 - formationProgress, 3);
      const presence = reducedMotion
        ? 0.9
        : elapsed > 2.25
          ? 0.9 + Math.sin(elapsed * 0.42) * 0.025
          : 1;
      const peakDistance = (elapsed - 1.85) / 0.48;
      const manifestationPeak = reducedMotion
        ? 1
        : 1 + Math.exp(-(peakDistance * peakDistance)) * 0.38;
      const energy =
        formation *
        presence *
        manifestationPeak *
        (1 + signalIntensity * 0.055);
      const shortSide = Math.min(width, height);
      const isMobile = window.innerWidth < 700;
      const centerX =
        width * (isMobile ? 0.55 : 0.52) + width * signalOffsetX;
      const centerY =
        height * (isMobile ? 0.39 : 0.5) + height * signalOffsetY;
      const radius = shortSide * (isMobile ? 0.46 : 0.48) * formation;
      const time = reducedMotion ? 1.4 : elapsed * 0.18;

      context.save();
      context.globalCompositeOperation = "lighter";
      context.translate(centerX, centerY);
      context.rotate(-0.08 + signalRotation);

      for (let ribbon = 0; ribbon < RIBBON_COUNT; ribbon += 1) {
        const config = RIBBON_CONFIGS[ribbon];
        const { seed, secondarySeed } = config;
        const span = radius * (0.7 + seed * 0.34);
        const phase = ribbon * 1.53 + time * (0.62 + seed * 0.28);
        const hue = Math.round(config.baseHue + signalHueShift);
        const palette = getRibbonPalette(
          hue,
          ribbon,
          config.baseOpacity,
        );

        for (let point = 0; point < RIBBON_POINT_COUNT; point += 1) {
          const progress = POINT_PROGRESS[point];
          const position = POINT_POSITION[point];
          const envelope = POINT_ENVELOPE[point];
          const curve =
            Math.sin(progress * Math.PI * (1.08 + seed * 0.34) + phase) *
            radius *
            (0.13 + secondarySeed * 0.1);
          const detail =
            Math.sin(progress * TAU * 2.15 - phase * 0.68) *
            radius *
            0.035 *
            envelope;
          const widthPulse = 0.58 + Math.sin(progress * TAU + phase) * 0.24;

          pointX[point] =
            position * span +
            (secondarySeed - 0.5) * radius * 0.28 +
            Math.sin(progress * TAU + phase) * radius * 0.025;
          pointY[point] =
            (ribbon - 1.5) * radius * 0.12 +
            curve +
            detail +
            position * radius * (seed - 0.5) * 0.22;
          pointWidth[point] =
            radius *
            (0.018 + seed * 0.018 + ribbon * 0.003) *
            envelope *
            widthPulse *
            (1 + (manifestationPeak - 1) * 0.32) *
            (1 + signalRibbonBoost);
        }

        context.save();
        context.rotate(config.rotation);
        context.beginPath();
        context.moveTo(pointX[0], pointY[0] - pointWidth[0]);
        for (let point = 1; point < RIBBON_POINT_COUNT; point += 1) {
          context.lineTo(
            pointX[point],
            pointY[point] - pointWidth[point],
          );
        }
        for (let point = RIBBON_POINT_COUNT - 1; point >= 0; point -= 1) {
          context.lineTo(
            pointX[point],
            pointY[point] + pointWidth[point],
          );
        }
        context.closePath();

        const ribbonGradient = context.createLinearGradient(-span, 0, span, 0);
        ribbonGradient.addColorStop(0, palette.fill[0]);
        ribbonGradient.addColorStop(0.22, palette.fill[1]);
        ribbonGradient.addColorStop(0.52 + seed * 0.1, palette.fill[2]);
        ribbonGradient.addColorStop(0.84, palette.fill[3]);
        ribbonGradient.addColorStop(1, palette.fill[4]);
        context.globalAlpha = energy;
        context.fillStyle = ribbonGradient;
        context.shadowColor = palette.shadow;
        context.shadowBlur = ribbon < 2 ? 10 + seed * 6 : 0;
        context.fill();

        context.shadowBlur = 0;
        context.beginPath();
        context.moveTo(pointX[0], pointY[0] - pointWidth[0] * 0.45);
        for (let point = 1; point < RIBBON_POINT_COUNT; point += 1) {
          context.lineTo(
            pointX[point],
            pointY[point] - pointWidth[point] * 0.45,
          );
        }
        const edgeGradient = context.createLinearGradient(-span, 0, span, 0);
        edgeGradient.addColorStop(0, palette.edge[0]);
        edgeGradient.addColorStop(0.34, palette.edge[1]);
        edgeGradient.addColorStop(0.62, palette.edge[2]);
        edgeGradient.addColorStop(1, palette.edge[3]);
        context.strokeStyle = edgeGradient;
        context.lineWidth = 0.7 + seed * 0.65;
        context.lineCap = "round";
        context.stroke();
        context.restore();
      }

      const visibleBranchCount = qualityScale < 0.8 ? 7 : BRANCH_COUNT;
      for (let branch = 0; branch < visibleBranchCount; branch += 1) {
        const config = BRANCH_CONFIGS[branch];
        const { seed, secondarySeed, direction } = config;
        const startX = radius * (-0.2 + seed * 0.42);
        const startY = radius * (-0.2 + secondarySeed * 0.4);
        const endX = startX + direction * radius * (0.42 + seed * 0.48);
        const endY = startY + radius * (secondarySeed - 0.5) * 0.82;
        const hue = Math.round(config.baseHue + signalHueShift);
        const palette = getBranchPalette(
          hue,
          branch,
          config.baseOpacity,
        );

        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(
          startX + direction * radius * (0.16 + seed * 0.14),
          startY + radius * (seed - 0.5) * 0.22,
          endX - direction * radius * (0.12 + secondarySeed * 0.12),
          endY - radius * (secondarySeed - 0.5) * 0.2,
          endX,
          endY,
        );
        const branchGradient = context.createLinearGradient(
          startX,
          startY,
          endX,
          endY,
        );
        branchGradient.addColorStop(0, palette.colors[0]);
        branchGradient.addColorStop(0.48, palette.colors[1]);
        branchGradient.addColorStop(1, palette.colors[2]);
        context.globalAlpha = energy * (1 + signalBranchBoost);
        context.strokeStyle = branchGradient;
        context.lineWidth = 0.55 + seed * 0.8;
        context.lineCap = "round";
        context.shadowBlur = 0;
        context.stroke();
      }

      context.restore();

      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    const restartDrawing = () => {
      window.cancelAnimationFrame(frame);
      lastDraw = 0;
      if (!document.hidden) frame = window.requestAnimationFrame(draw);
    };

    resize();
    frame = window.requestAnimationFrame(draw);
    const handleResize = () => {
      resize();

      if (reducedMotion) {
        restartDrawing();
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        return;
      }

      restartDrawing();
    };
    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      restartDrawing();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener(
        "change",
        handleReducedMotionChange,
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.phenomenon}
      aria-hidden="true"
    />
  );
}
