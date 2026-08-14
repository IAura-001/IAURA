"use client";

import {
  useCallback,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import type { ChatMessage } from "@/types/chat";
import type { IAuraProject } from "@/types/project";
import type {
  AuraExperienceChoice,
  AuraExperienceSurface,
} from "@/core/actions";
import { BrandIdentityCard } from "../cards/BrandIdentityCard";
import { BetaNextStepCard } from "../cards/BetaNextStepCard";
import { BetaExecutionEvaluationCard } from "../cards/BetaExecutionEvaluationCard";
import { BetaSessionReviewCard } from "../cards/BetaSessionReviewCard";
import AuraExperienceCard from "./AuraExperienceCard";
import { useI18n } from "@/core/i18n/I18nContext";
import {
  BRAND_PALETTE_PRESETS,
  DEFAULT_BRAND_LOGO,
} from "@/core/branding/brandProfile";
import {
  anchoredDocumentScrollTop,
  conversationGrowthDecision,
  conversationScrollDecision,
  isConversationNearBottom,
  returnToLatestScrollBehavior,
} from "./conversationAutoScroll";

interface ConversationProps {
  messages: ChatMessage[];
  conversationKey?: string | null;
  olderMessageCount?: number;
  onLoadOlder?: () => void;
  animatedMessageIds?: ReadonlySet<string>;
  isThinking?: boolean;
  project?: IAuraProject | null;
  onOpenBranding?: () => void;
  onChoose?: (choice: AuraExperienceChoice, sourceMessageId: string) => void | Promise<void>;
  onOpenSurface?: (surface: AuraExperienceSurface) => void;
  isBusy?: boolean;
}

interface AnimatedMessageProps {
  message: ChatMessage;
  animate?: boolean;
  onChoose?: (choice: AuraExperienceChoice, sourceMessageId: string) => void | Promise<void>;
  onOpenSurface?: (surface: AuraExperienceSurface) => void;
  isBusy?: boolean;
}

const AnimatedMessage = memo(
  function AnimatedMessage({
    message,
    animate = false,
    onChoose,
    onOpenSurface,
    isBusy = false,
  }: AnimatedMessageProps) {
    const { t } = useI18n();
    const isAssistant =
      message.role === "assistant";
    const [visibleContent, setVisibleContent] =
      useState(
        isAssistant && animate ? "" : message.content
      );
    const words = useMemo(
      () => message.content.split(" "),
      [message.content]
    );

    useEffect(() => {
      if (!isAssistant || !animate) return;

      let wordIndex = 0;
      const typingTimer =
        window.setInterval(() => {
          wordIndex += 1;
          setVisibleContent(
            words
              .slice(0, wordIndex)
              .join(" ")
          );

          if (wordIndex >= words.length) {
            window.clearInterval(typingTimer);
          }
        }, 35);

      return () => {
        window.clearInterval(typingTimer);
      };
    }, [animate, isAssistant, words]);

    return (
      <article
        className={[
          "aura-message relative overflow-hidden rounded-2xl border p-5",
          animate ? "animate-[message-enter_500ms_ease-out]" : "",
          isAssistant
            ? "border-purple-400/20 bg-purple-500/[0.04]"
            : "border-white/10 bg-white/[0.03]",
        ].join(" ")}
      >
        {isAssistant && (
          <div
            aria-hidden="true"
            className="aura-response-line absolute left-0 top-0 h-px w-full"
          />
        )}

        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-8 w-8 items-center justify-center rounded-xl text-sm",
              isAssistant
                ? "bg-gradient-to-br from-purple-500 to-blue-600 shadow-[0_0_20px_rgba(147,51,234,0.35)]"
                : "bg-white/10",
            ].join(" ")}
          >
            {isAssistant ? "✦" : "●"}
          </div>

          <div>
            <p
              className={[
                "text-sm font-medium",
                isAssistant
                  ? "text-purple-200"
                  : "text-zinc-200",
              ].join(" ")}
            >
              {isAssistant
                ? "IAURA"
                : t("conversation.you")}
            </p>

            <p className="text-xs text-zinc-600">
              {isAssistant
                ? t(
                    "conversation.assistantSubtitle"
                  )
                : t(
                    "conversation.userSubtitle"
                  )}
            </p>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap leading-7 text-zinc-200">
          {visibleContent}

          {isAssistant &&
            visibleContent.length <
              message.content.length && (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-purple-300 align-middle"
              />
            )}
        </p>

        {isAssistant &&
          visibleContent.length ===
            message.content.length && (
            <>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                {t("conversation.completed")}
              </div>

              {message.experience ? (
                <AuraExperienceCard
                  experience={message.experience}
                  sourceMessageId={message.id}
                  disabled={isBusy}
                  onChoose={onChoose}
                  onOpenSurface={onOpenSurface}
                  showChoices={
                    !message.betaNextStep && !message.betaExecutionEvaluation
                    && !message.betaSessionEvaluation
                  }
                />
              ) : null}

              {message.betaNextStep ? (
                <BetaNextStepCard
                  recommendation={message.betaNextStep}
                  choices={message.experience?.choices ?? []}
                  sourceMessageId={message.id}
                  confirmed={message.betaNextStepConfirmed}
                  disabled={isBusy}
                  onChoose={onChoose}
                  sessionDecision={message.betaSessionDecision}
                />
              ) : null}

              {message.betaExecutionEvaluation ? (
                <BetaExecutionEvaluationCard
                  evaluation={message.betaExecutionEvaluation}
                  choices={message.experience?.choices ?? []}
                  sourceMessageId={message.id}
                  verified={message.betaExecutionVerified}
                  disabled={isBusy}
                  onChoose={onChoose}
                />
              ) : null}

              {message.betaSessionEvaluation ? (
                <BetaSessionReviewCard
                  evaluation={message.betaSessionEvaluation}
                  choices={message.experience?.choices ?? []}
                  sourceMessageId={message.id}
                  confirmed={message.betaSessionEvaluationConfirmed}
                  closed={message.betaSessionClosed}
                  disabled={isBusy}
                  onChoose={onChoose}
                />
              ) : null}
            </>
          )}
      </article>
    );
  }
);

AnimatedMessage.displayName = "AnimatedMessage";

function AuraThinking() {
  const { t } = useI18n();

  return (
    <div
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-purple-400/20 bg-purple-500/[0.04] p-5"
    >
      <div className="aura-thinking-line absolute left-0 top-0 h-px w-full" />

      <div className="flex items-center gap-4">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/20" />
          <div className="absolute inset-1 animate-pulse rounded-full border border-purple-400/30" />
          <span className="relative text-lg text-purple-200">
            ✦
          </span>
        </div>

        <div>
          <p className="text-sm font-medium text-purple-200">
            {t("conversation.thinking")}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            {t(
              "conversation.thinkingSubtitle"
            )}
          </p>
        </div>

        <div className="ml-auto flex gap-1">
          <span className="aura-dot h-1.5 w-1.5 rounded-full bg-purple-300" />
          <span className="aura-dot h-1.5 w-1.5 rounded-full bg-purple-300 [animation-delay:150ms]" />
          <span className="aura-dot h-1.5 w-1.5 rounded-full bg-purple-300 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function Conversation({
  messages,
  conversationKey = null,
  olderMessageCount = 0,
  onLoadOlder,
  animatedMessageIds,
  isThinking = false,
  project,
  onOpenBranding,
  onChoose,
  onOpenSurface,
  isBusy = false,
}: ConversationProps) {
  const { t } = useI18n();
  const branding = project?.branding;
  const contentRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const loadOlderAnchorRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const suppressHistoricalResizeRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const initialPositionFrameRef = useRef<number | null>(null);
  const initialPositionInnerFrameRef = useRef<number | null>(null);
  const initialPositionReleaseFrameRef = useRef<number | null>(null);
  const initialPositionReadyRef = useRef(false);
  const initialPositionScrollRef = useRef(false);
  const currentConversationKeyRef = useRef(conversationKey);
  const latestMessageIdRef = useRef(messages.at(-1)?.id);
  const [unseenContent, setUnseenContent] = useState<{
    conversationKey: string | null;
    visible: boolean;
  }>({ conversationKey, visible: false });
  const hasUnseenNewContent =
    unseenContent.conversationKey === conversationKey && unseenContent.visible;
  const latestMessageId = messages.at(-1)?.id;
  const setHasUnseenNewContent = useCallback((visible: boolean) => {
    setUnseenContent((current) =>
      current.conversationKey === conversationKey && current.visible === visible
        ? current
        : { conversationKey, visible },
    );
  }, [conversationKey]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    autoFollowRef.current = true;
    setHasUnseenNewContent(false);
    endRef.current?.scrollIntoView?.({ behavior, block: "end" });
  }, [setHasUnseenNewContent]);

  useLayoutEffect(() => {
    autoFollowRef.current = true;
    initialPositionReadyRef.current = false;
    currentConversationKeyRef.current = conversationKey;
  }, [conversationKey]);

  useLayoutEffect(() => {
    latestMessageIdRef.current = latestMessageId;
  }, [latestMessageId]);

  useEffect(() => {
    if (!latestMessageId || initialPositionReadyRef.current) return;

    const requestedConversationKey = conversationKey;
    initialPositionFrameRef.current = window.requestAnimationFrame(() => {
      initialPositionFrameRef.current = null;
      initialPositionInnerFrameRef.current = window.requestAnimationFrame(() => {
        initialPositionInnerFrameRef.current = null;
        if (
          currentConversationKeyRef.current !== requestedConversationKey ||
          latestMessageIdRef.current !== latestMessageId ||
          !contentRef.current ||
          !endRef.current
        ) {
          return;
        }
        initialPositionReadyRef.current = true;
        autoFollowRef.current = true;
        setHasUnseenNewContent(false);
        initialPositionScrollRef.current = true;
        contentRef.current.scrollIntoView?.({ behavior: "auto", block: "start" });
        initialPositionReleaseFrameRef.current = window.requestAnimationFrame(() => {
          initialPositionReleaseFrameRef.current = window.requestAnimationFrame(() => {
            initialPositionReleaseFrameRef.current = null;
            initialPositionScrollRef.current = false;
          });
        });
      });
    });

    return () => {
      if (initialPositionFrameRef.current !== null) {
        window.cancelAnimationFrame(initialPositionFrameRef.current);
        initialPositionFrameRef.current = null;
      }
      if (initialPositionInnerFrameRef.current !== null) {
        window.cancelAnimationFrame(initialPositionInnerFrameRef.current);
        initialPositionInnerFrameRef.current = null;
      }
      if (initialPositionReleaseFrameRef.current !== null) {
        window.cancelAnimationFrame(initialPositionReleaseFrameRef.current);
        initialPositionReleaseFrameRef.current = null;
      }
      initialPositionScrollRef.current = false;
    };
  }, [conversationKey, latestMessageId, setHasUnseenNewContent]);

  useEffect(() => {
    const handleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        if (initialPositionScrollRef.current) return;
        const end = endRef.current;
        if (!end) return;
        const nearBottom = isConversationNearBottom(
          end.getBoundingClientRect().bottom,
          window.innerHeight,
        );
        const decision = conversationScrollDecision(
          nearBottom,
          hasUnseenNewContent,
        );
        autoFollowRef.current = decision.autoFollowEnabled;
        setHasUnseenNewContent(decision.hasUnseenNewContent);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [hasUnseenNewContent, setHasUnseenNewContent]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    let previousHeight = content.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const nextHeight = content.getBoundingClientRect().height;
      if (nextHeight === previousHeight) return;
      previousHeight = nextHeight;

      if (suppressHistoricalResizeRef.current) {
        suppressHistoricalResizeRef.current = false;
        return;
      }

      const decision = conversationGrowthDecision(autoFollowRef.current);
      if (decision.shouldFollow) {
        scrollToLatest();
      } else {
        setHasUnseenNewContent(decision.hasUnseenNewContent);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [conversationKey, scrollToLatest, setHasUnseenNewContent]);

  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const anchor = loadOlderAnchorRef.current;
    if (anchor) {
      loadOlderAnchorRef.current = null;
      suppressHistoricalResizeRef.current = true;
      window.scrollTo({
        top: anchoredDocumentScrollTop(
          anchor.scrollTop,
          anchor.scrollHeight,
          document.documentElement.scrollHeight,
        ),
        behavior: "auto",
      });
      return;
    }

    if (!initialPositionReadyRef.current) return;

    const decision = conversationGrowthDecision(autoFollowRef.current);
    if (decision.shouldFollow) scrollToLatest();
    else setHasUnseenNewContent(decision.hasUnseenNewContent);
  }, [
    conversationKey,
    messages.length,
    scrollToLatest,
    setHasUnseenNewContent,
  ]);

  const handleLoadOlder = useCallback(() => {
    if (!onLoadOlder) return;
    autoFollowRef.current = false;
    loadOlderAnchorRef.current = {
      scrollHeight: document.documentElement.scrollHeight,
      scrollTop: window.scrollY,
    };
    onLoadOlder();
  }, [onLoadOlder]);

  const handleReturnToLatest = useCallback(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scrollToLatest(returnToLatestScrollBehavior(reducedMotion ?? false));
  }, [scrollToLatest]);

  if (
    messages.length === 0 &&
    !isThinking
  ) {
    return null;
  }

  return (
    <section
      ref={contentRef}
      data-testid="conversation-window"
      className="relative space-y-4"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

        <p className="text-xs tracking-[0.25em] text-zinc-600">
          {t("conversation.title")}
        </p>

        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      </div>

      {olderMessageCount > 0 && onLoadOlder ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadOlder}
            className="min-h-10 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-400 transition hover:border-purple-400/30 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
          >
            Cargar mensajes anteriores
          </button>
        </div>
      ) : null}

      {messages.map((message) => (
        <AnimatedMessage
          key={message.id}
          message={message}
          animate={animatedMessageIds?.has(message.id) ?? false}
          onChoose={onChoose}
          onOpenSurface={onOpenSurface}
          isBusy={isBusy}
        />
      ))}

      {project && onOpenBranding && (
        <BrandIdentityCard
          name={branding?.brandName || project.name}
          slogan={branding?.slogan || t("brand.identitySlogan")}
          mission={
            branding?.mission ||
            project.description ||
            t("brand.identityMission")
          }
          colors={
            branding
              ? [
                  branding.palette.primary,
                  branding.palette.secondary,
                  branding.palette.accent,
                ]
              : ["#2563EB", "#7C3AED", "#0F172A"]
          }
          logo={branding?.logo || DEFAULT_BRAND_LOGO}
          palette={
            branding?.palette || BRAND_PALETTE_PRESETS[0].palette
          }
          font={
            branding
              ? t(`branding.typography.${branding.typography}`)
              : "Inter"
          }
          onContinue={onOpenBranding}
        />
      )}

      {isThinking && <AuraThinking />}

      <div
        ref={endRef}
        data-testid="conversation-end"
        aria-hidden="true"
        className="h-px"
      />

      {hasUnseenNewContent ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={handleReturnToLatest}
            className="pointer-events-auto min-h-10 rounded-full border border-purple-400/30 bg-[#11111a]/95 px-4 py-2 text-sm font-medium text-purple-100 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur transition hover:border-purple-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
          >
            Volver al final ↓
          </button>
        </div>
      ) : null}

      <style jsx>{`
        .aura-response-line,
        .aura-thinking-line {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(168, 85, 247, 0.95),
            rgba(59, 130, 246, 0.95),
            transparent
          );
          background-size: 200% 100%;
          animation: aura-line 1.8s linear
            infinite;
        }

        .aura-message::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          background: radial-gradient(
            circle at top left,
            rgba(168, 85, 247, 0.08),
            transparent 45%
          );
          animation: aura-flash 900ms ease-out;
        }

        .aura-dot {
          animation: aura-dot 900ms ease-in-out
            infinite;
        }

        @keyframes message-enter {
          from {
            opacity: 0;
            transform: translateY(16px)
              scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes aura-line {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        @keyframes aura-flash {
          0% {
            opacity: 0.8;
          }

          100% {
            opacity: 0;
          }
        }

        @keyframes aura-dot {
          0%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }

          50% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-response-line,
          .aura-thinking-line,
          .aura-dot,
          .aura-message::before {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
