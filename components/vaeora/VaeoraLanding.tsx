"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./VaeoraLanding.module.css";

const TAU = Math.PI * 2;

export default function VaeoraLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastDraw = 0;
    let qualityScale = 1;
    let slowFrameCount = 0;
    let fastFrameCount = 0;
    let targetPixelRatio = 1;
    const startedAt = performance.now();

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
      const pixelRatio = Math.max(1, targetPixelRatio * qualityScale);
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

        if (slowFrameCount >= 60 && qualityScale > 0.7) {
          qualityScale = Math.max(0.7, qualityScale - 0.15);
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
      const energy = formation * presence * manifestationPeak;
      const shortSide = Math.min(width, height);
      const isMobile = window.innerWidth < 700;
      const centerX = width * (isMobile ? 0.55 : 0.52);
      const centerY = height * (isMobile ? 0.39 : 0.5);
      const radius = shortSide * (isMobile ? 0.46 : 0.48) * formation;
      const time = reducedMotion ? 1.4 : elapsed * 0.18;

      context.save();
      context.globalCompositeOperation = "lighter";
      context.translate(centerX, centerY);
      context.rotate(-0.08);

      type RibbonPoint = { x: number; y: number; width: number };

      for (let ribbon = 0; ribbon < 4; ribbon += 1) {
        const seed = Math.sin((ribbon + 1) * 73.19) * 0.5 + 0.5;
        const secondarySeed = Math.cos((ribbon + 1) * 41.73) * 0.5 + 0.5;
        const span = radius * (0.7 + seed * 0.34);
        const phase = ribbon * 1.53 + time * (0.62 + seed * 0.28);
        const hue = 228 + ribbon * 6;
        const ribbonOpacity = (0.034 + ribbon * 0.007) * energy;
        const points: RibbonPoint[] = [];

        for (let point = 0; point <= 42; point += 1) {
          const progress = point / 42;
          const position = progress * 2 - 1;
          const envelope = Math.pow(Math.sin(progress * Math.PI), 1.25);
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

          points.push({
            x:
              position * span +
              (secondarySeed - 0.5) * radius * 0.28 +
              Math.sin(progress * TAU + phase) * radius * 0.025,
            y:
              (ribbon - 1.5) * radius * 0.12 +
              curve +
              detail +
              position * radius * (seed - 0.5) * 0.22,
            width:
              radius *
              (0.018 + seed * 0.018 + ribbon * 0.003) *
              envelope *
              widthPulse *
              (1 + (manifestationPeak - 1) * 0.32),
          });
        }

        context.save();
        context.rotate(-0.18 + ribbon * 0.105);
        context.beginPath();
        points.forEach((point, index) => {
          const y = point.y - point.width;
          if (index === 0) context.moveTo(point.x, y);
          else context.lineTo(point.x, y);
        });
        [...points].reverse().forEach((point) => {
          context.lineTo(point.x, point.y + point.width);
        });
        context.closePath();

        const ribbonGradient = context.createLinearGradient(-span, 0, span, 0);
        ribbonGradient.addColorStop(0, `hsla(${hue}, 96%, 68%, 0)`);
        ribbonGradient.addColorStop(
          0.22,
          `hsla(${hue}, 96%, 69%, ${ribbonOpacity * 0.34})`,
        );
        ribbonGradient.addColorStop(
          0.52 + seed * 0.1,
          `hsla(${hue}, 98%, 73%, ${ribbonOpacity})`,
        );
        ribbonGradient.addColorStop(
          0.84,
          `hsla(${hue}, 96%, 68%, ${ribbonOpacity * 0.24})`,
        );
        ribbonGradient.addColorStop(1, `hsla(${hue}, 96%, 68%, 0)`);
        context.fillStyle = ribbonGradient;
        context.shadowColor = `hsla(${hue}, 100%, 66%, ${ribbon < 2 ? 0.3 : 0})`;
        context.shadowBlur = ribbon < 2 ? 10 + seed * 6 : 0;
        context.fill();

        context.shadowBlur = 0;
        context.beginPath();
        points.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y - point.width * 0.45);
          else context.lineTo(point.x, point.y - point.width * 0.45);
        });
        const edgeGradient = context.createLinearGradient(-span, 0, span, 0);
        edgeGradient.addColorStop(0, `hsla(${hue}, 100%, 78%, 0)`);
        edgeGradient.addColorStop(
          0.34,
          `hsla(${hue}, 100%, 78%, ${0.08 * energy})`,
        );
        edgeGradient.addColorStop(
          0.62,
          `hsla(${hue}, 100%, 82%, ${0.17 * energy})`,
        );
        edgeGradient.addColorStop(1, `hsla(${hue}, 100%, 78%, 0)`);
        context.strokeStyle = edgeGradient;
        context.lineWidth = 0.7 + seed * 0.65;
        context.lineCap = "round";
        context.stroke();
        context.restore();
      }

      for (let branch = 0; branch < 9; branch += 1) {
        const seed = Math.sin((branch + 1) * 57.31) * 0.5 + 0.5;
        const secondarySeed = Math.cos((branch + 1) * 83.17) * 0.5 + 0.5;
        const direction = branch % 3 === 0 ? -1 : 1;
        const startX = radius * (-0.2 + seed * 0.42);
        const startY = radius * (-0.2 + secondarySeed * 0.4);
        const endX = startX + direction * radius * (0.42 + seed * 0.48);
        const endY = startY + radius * (secondarySeed - 0.5) * 0.82;
        const hue = 228 + (branch % 5) * 6;
        const branchOpacity = (0.07 + (branch % 4) * 0.018) * energy;

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
        const branchGradient = context.createLinearGradient(startX, startY, endX, endY);
        branchGradient.addColorStop(
          0,
          `hsla(${hue}, 100%, 79%, ${branchOpacity * 0.72})`,
        );
        branchGradient.addColorStop(
          0.48,
          `hsla(${hue}, 100%, 75%, ${branchOpacity})`,
        );
        branchGradient.addColorStop(1, `hsla(${hue}, 100%, 72%, 0)`);
        context.strokeStyle = branchGradient;
        context.lineWidth = 0.55 + seed * 0.8;
        context.lineCap = "round";
        context.shadowBlur = 0;
        context.stroke();
      }

      context.restore();

      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    frame = window.requestAnimationFrame(draw);
    const handleResize = () => {
      resize();

      if (reducedMotion) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(draw);
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        return;
      }

      lastDraw = 0;
      frame = window.requestAnimationFrame(draw);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <main className={styles.landing}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.manifestationGlow} aria-hidden="true" />
      <div className={styles.disturbance} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.phenomenon} aria-hidden="true" />
      <section className={styles.hero} aria-labelledby="vaeora-title">
        <div className={styles.identity}>
          <p className={styles.status}>Coming into focus.</p>
          <h1 id="vaeora-title" className={styles.wordmark}>VAEORA</h1>
          <p className={styles.tagline}>Where intelligence takes shape.</p>
          <Link className={styles.entry} href="/iaura">
            <span>Enter</span>
            <span className={styles.entryLine} aria-hidden="true" />
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
