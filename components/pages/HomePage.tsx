"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CreativeStudioArea,
  CreativeStudioRequest,
} from "@/types/creative-studio";
import type { ChatMessage } from "@/types/chat";
import type { IAuraProject } from "@/types/project";

import { theme } from "@/config/theme";
import {
  formatActionReceipt,
  type AuraExperienceChoice,
  type AuraExperienceSurface,
} from "@/core/actions";
import {
  conversationController,
  conversationRepository,
} from "@/core/conversation";
import { useVoiceContext } from "@/core/context/VoiceContext";
import {
  I18nProvider,
} from "@/core/i18n/I18nContext";
import {
  translate,
} from "@/core/i18n/messages";
import { performanceMonitor } from "@/core/performance";

import { useAuraActions } from "@/hooks/useAuraActions";
import { useMemory } from "@/hooks/useMemory";

import { buildUserContext } from "@/utils/context";
import { cleanAIText } from "@/utils/formatText";

import Workspace from "@/components/pages/Workspace";
import {
  canApplyConversationHydration,
  didActiveProjectChange,
  loadVisibleConversation,
} from "@/components/pages/conversationHydration";
import {
  initialConversationVisibleStart,
  loadOlderConversationStart,
  visibleConversationMessages,
} from "@/components/pages/conversationWindowing";
import { ActionCenter } from "@/components/sections/ActionCenter";
import AssistantCard from "@/components/sections/AssistantCard";
import AuraStartingPoints from "@/components/sections/AuraStartingPoints";
import { ChatInput } from "@/components/sections/ChatInput";
import { Conversation } from "@/components/sections/Conversation";
import Hero from "@/components/sections/Hero";
import PersonalIntelligenceCenter from "@/components/sections/PersonalIntelligenceCenter";
import VaeoraWorkspaceShell, {
  type WorkspaceEntryIntent,
  type WorkspaceView,
} from "@/components/vaeora/VaeoraWorkspaceShell";
import WelcomeOverlay from "@/components/vaeora/WelcomeOverlay";

interface HomePageProps {
  initialView?: WorkspaceView;
  entryIntent?: WorkspaceEntryIntent;
  authenticatedDisplayName?: string;
}

export default function Home({
  initialView = "presence",
  entryIntent,
  authenticatedDisplayName = "",
}: HomePageProps) {
  const {
    speak,
    voiceMode,
    setVoiceMode,
    setLanguage,
    startListening,
    startContinuousListening,
    stopContinuousListening,
    stopSpeaking,
    unlockAudio,
  } = useVoiceContext();

  const {
    memory,
    isLoaded,
    updateMemory,
    resetMemory,
    replaceMemory,
  } = useMemory();

  const {
    history: actionHistory,
    executeActions,
    canUndoLast,
    undoLast,
  } = useAuraActions({
    memory,
    replaceMemory,
  });

  const [
    activeWorkspaceView,
    setActiveWorkspaceView,
  ] = useState<WorkspaceView>(initialView);
  const [
    creativeStudioRequest,
    setCreativeStudioRequest,
  ] = useState<CreativeStudioRequest>();
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);
  const [visibleStartIndex, setVisibleStartIndex] =
    useState(0);
  const [conversationNavigation, setConversationNavigation] = useState<{
    targetMessageId?: string;
    requestId: number;
  }>({ requestId: 0 });
  const [animatedMessageIds, setAnimatedMessageIds] =
    useState<ReadonlySet<string>>(() => new Set());
  const [isSending, setIsSending] =
    useState(false);
  const [isAuraLive, setIsAuraLive] =
    useState(false);

  const auraLiveRef = useRef(false);
  const auraLiveRestartTimerRef =
    useRef<number | null>(null);
  const workspaceRequestIdRef = useRef(0);
  const activeProjectIdRef = useRef<string | null>(null);
  const messageGenerationRef = useRef(0);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setLanguage(memory.preferredLocale);
    document.documentElement.lang =
      memory.preferredLocale;
  }, [
    isLoaded,
    memory.preferredLocale,
    setLanguage,
  ]);

  useEffect(() => {
    return () => {
      if (
        auraLiveRestartTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          auraLiveRestartTimerRef.current,
        );
      }
    };
  }, []);

  const activeProject = memory.activeProject;
  const activeProjectId = activeProject?.id ?? null;

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    if (!isLoaded) return;

    const requestedProjectId = activeProjectId;
    const scheduledMessageGeneration = messageGenerationRef.current;
    const hydrationTimer = window.setTimeout(() => {
      if (!canApplyConversationHydration({
        requestedProjectId,
        activeProjectId: activeProjectIdRef.current,
        scheduledMessageGeneration,
        currentMessageGeneration: messageGenerationRef.current,
      })) {
        return;
      }

      const hydratedMessages = loadVisibleConversation(
        conversationRepository,
        requestedProjectId,
      );
      setMessages(hydratedMessages);
      setVisibleStartIndex(
        initialConversationVisibleStart(hydratedMessages.length),
      );
      setAnimatedMessageIds(new Set());
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, [activeProjectId, isLoaded]);

  const openCreativeStudio = useCallback(
    (
      area:
        | CreativeStudioArea
        | "launch",
    ) => {
      workspaceRequestIdRef.current += 1;

      const id =
        workspaceRequestIdRef.current;

      setActiveWorkspaceView("projects");
      setCreativeStudioRequest({
        id,
        area,
      });
    },
    [],
  );

  const openExperienceSurface = useCallback(
    (surface: AuraExperienceSurface) => {
      switch (surface) {
        case "presence":
          setActiveWorkspaceView(
            "presence",
          );
          return;

        case "projects":
          setActiveWorkspaceView(
            "projects",
          );
          return;

        case "intelligence":
          setActiveWorkspaceView(
            "intelligence",
          );
          return;

        case "creative-direction":
          openCreativeStudio("direction");
          return;

        case "creative-image":
          openCreativeStudio("image");
          return;

        case "creative-website":
          openCreativeStudio("website");
          return;

        case "creative-library":
          openCreativeStudio("library");
          return;

        case "launch":
          openCreativeStudio("launch");
          return;

        default:
          return;
      }
    },
    [openCreativeStudio],
  );

  const handleWorkspaceProjectSelected =
    useCallback(
      (
        project: IAuraProject | null,
      ) => {
        const nextProjectId = project?.id ?? null;

        if (didActiveProjectChange(activeProjectId, nextProjectId)) {
          messageGenerationRef.current += 1;
          setMessages([]);
          setVisibleStartIndex(0);
          setAnimatedMessageIds(new Set());
        }

        updateMemory({
          activeProject: project,
        });
      },
      [activeProjectId, updateMemory],
    );

  const handleWelcomeContinue =
    useCallback(() => {
      updateMemory({
        hasCompletedOnboarding: true,
      });
    }, [updateMemory]);

  const handleContinueWithAura = useCallback((targetMessageId?: string) => {
    if (targetMessageId) {
      const targetIndex = messages.findIndex(
        (message) => message.id === targetMessageId,
      );
      if (targetIndex >= 0) {
        setVisibleStartIndex((current) => Math.min(current, targetIndex));
      }
    }
    setConversationNavigation((current) => ({
      ...(targetMessageId ? { targetMessageId } : {}),
      requestId: current.requestId + 1,
    }));
    setActiveWorkspaceView("presence");
  }, [messages]);

  const userContext = buildUserContext({
    ...memory,
    userName: authenticatedDisplayName,
  });

  const visibleMessages = useMemo(
    () => visibleConversationMessages(messages, visibleStartIndex),
    [messages, visibleStartIndex],
  );
  const handleLoadOlderMessages = useCallback(() => {
    setVisibleStartIndex((current) => loadOlderConversationStart(current));
  }, []);

  const stopAuraLive =
    useCallback(() => {
      auraLiveRef.current = false;
      setIsAuraLive(false);

      if (
        auraLiveRestartTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          auraLiveRestartTimerRef.current,
        );

        auraLiveRestartTimerRef.current =
          null;
      }

      stopContinuousListening();
      stopSpeaking();
    }, [
      stopContinuousListening,
      stopSpeaking,
    ]);

  const scheduleAuraLiveListening =
    useCallback(() => {
      if (!auraLiveRef.current) {
        return;
      }

      if (
        auraLiveRestartTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          auraLiveRestartTimerRef.current,
        );
      }

      auraLiveRestartTimerRef.current =
        window.setTimeout(() => {
          auraLiveRestartTimerRef.current =
            null;

          if (auraLiveRef.current) {
            void startListening();
          }
        }, 350);
    }, [startListening]);

  const toggleAuraLive =
    useCallback(() => {
      if (auraLiveRef.current) {
        stopAuraLive();
        return;
      }

      if (isSending) {
        return;
      }

      auraLiveRef.current = true;
      setIsAuraLive(true);
      setVoiceMode(true);

      void unlockAudio();
      void startContinuousListening();
    }, [
      isSending,
      setVoiceMode,
      startContinuousListening,
      stopAuraLive,
      unlockAudio,
    ]);

  const handleSend = useCallback(
    async (
      missionOverride?: string | AuraExperienceChoice,
      sourceMessageId?: string,
    ) => {
      const trimmedInput =
        (typeof missionOverride === "string"
          ? missionOverride
          : missionOverride?.prompt
        )?.trim();

      if (
        !trimmedInput ||
        isSending
      ) {
        return;
      }

      const requestFromAuraLive =
        auraLiveRef.current;
      const responseStartedAt =
        performance.now();

      const userMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        role: "user",
        content: trimmedInput,
      };

      messageGenerationRef.current += 1;
      setAnimatedMessageIds((current) =>
        new Set([...current, userMessage.id]),
      );
      setMessages((previous) => [
        ...previous,
        userMessage,
      ]);

      setIsSending(true);

      try {
        const turn =
          typeof missionOverride === "object"
            ? await conversationController.sendChoice(
                missionOverride,
                sourceMessageId ?? "",
                userContext,
              )
            : await conversationController.send(
                trimmedInput,
                userContext,
              );
        const response = turn.plan;

        if (
          typeof missionOverride === "object" &&
          missionOverride.confirmation?.kind === "beta-session-decision"
        ) {
          const decision = missionOverride.confirmation.decision;
          setMessages((previous) => {
            const recommendationIndex = previous.findLastIndex(
              (message) => Boolean(message.betaNextStep),
            );
            return previous.map((message, index) =>
              message.id === sourceMessageId || index === recommendationIndex
                ? {
                    ...message,
                    ...(message.id === sourceMessageId
                      ? { betaSessionDecisionConfirmed: true }
                      : {}),
                    ...(index === recommendationIndex
                      ? {
                          betaNextStepConfirmed: true,
                          betaSessionDecision: decision,
                        }
                      : {}),
                  }
                : message,
            );
          });
        }

        if (
          typeof missionOverride === "object" &&
          missionOverride.confirmation?.kind === "beta-execution-evaluation" &&
          sourceMessageId
        ) {
          setMessages((previous) => previous.map((message) =>
            message.id === sourceMessageId
              ? { ...message, betaExecutionVerified: true }
              : message,
          ));
        }

        if (
          typeof missionOverride === "object" &&
          missionOverride.confirmation?.kind === "beta-incomplete-execution-recovery" &&
          sourceMessageId
        ) {
          const decision = missionOverride.confirmation.decision;
          setMessages((previous) => previous.map((message) =>
            message.id === sourceMessageId
              ? { ...message, betaIncompleteExecutionRecoveryDecision: decision }
              : message,
          ));
        }

        if (
          typeof missionOverride === "object" &&
          missionOverride.confirmation?.kind === "beta-session-evaluation" &&
          sourceMessageId
        ) {
          setMessages((previous) => previous.map((message) =>
            message.id === sourceMessageId
              ? { ...message, betaSessionEvaluationConfirmed: true }
              : message,
          ));
        }

        if (
          typeof missionOverride === "object" &&
          missionOverride.confirmation?.kind === "beta-post-closure-handoff" &&
          sourceMessageId
        ) {
          const decision = missionOverride.confirmation.decision;
          setMessages((previous) => previous.map((message) =>
            message.id === sourceMessageId
              ? { ...message, betaPostClosureDecision: decision }
              : message,
          ));
        }

        const actionItems =
          executeActions(
            response.actions,
          );
        const actionReceipt =
          formatActionReceipt(
            actionItems,
          );
        const spokenContent =
          cleanAIText(
            response.content,
          );

        const content = [
          spokenContent,
          actionReceipt,
        ]
          .filter(Boolean)
          .join("\n\n");

        const assistantMessage: ChatMessage =
          {
            id: turn.assistantMessageId,
            role: "assistant",
            content,
            experience:
              response.experience,
            ...(response.betaNextStep
              ? { betaNextStep: response.betaNextStep }
              : {}),
            ...(response.betaExecutionEvaluation
              ? { betaExecutionEvaluation: response.betaExecutionEvaluation }
              : {}),
            ...(response.betaSessionEvaluation
              ? { betaSessionEvaluation: response.betaSessionEvaluation }
              : {}),
          };

        messageGenerationRef.current += 1;
        setAnimatedMessageIds((current) =>
          new Set([...current, assistantMessage.id]),
        );
        setMessages((previous) => {
          const isPostClosureHandoff = response.experience.choices.some(
            (choice) => choice.confirmation?.kind === "beta-post-closure-handoff",
          );
          const confirmedReview = isPostClosureHandoff
            ? previous.findLast((message) =>
                message.betaSessionEvaluationConfirmed && message.betaSessionEvaluation)
            : undefined;
          return [
            ...previous,
            confirmedReview?.betaSessionEvaluation
              ? {
                  ...assistantMessage,
                  betaSessionEvaluation: confirmedReview.betaSessionEvaluation,
                  betaSessionEvaluationConfirmed: true,
                  betaSessionClosed: true,
                }
              : assistantMessage,
          ];
        });

        if (
          voiceMode &&
          (!requestFromAuraLive ||
            auraLiveRef.current)
        ) {
          const playback =
            speak(spokenContent);

          if (auraLiveRef.current) {
            try {
              await playback;
            } catch (error) {
              console.error(
                "IAURA voice playback failed:",
                error,
              );
            }
          } else {
            void playback.catch(
              (error) => {
                console.error(
                  "IAURA voice playback failed:",
                  error,
                );
              },
            );
          }
        }
      } catch (error) {
        console.error(
          "IAURA conversation failed:",
          error,
        );

        const errorContent =
          translate(
            memory.preferredLocale,
            "error.conversation",
          );

        const errorMessage: ChatMessage =
          {
            id: `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,
            role: "assistant",
            content: errorContent,
          };

        messageGenerationRef.current += 1;
        setAnimatedMessageIds((current) =>
          new Set([...current, errorMessage.id]),
        );
        setMessages((previous) => [
          ...previous,
          errorMessage,
        ]);

        if (
          voiceMode &&
          auraLiveRef.current &&
          requestFromAuraLive
        ) {
          try {
            await speak(errorContent);
          } catch (voiceError) {
            console.error(
              "IAURA voice playback failed:",
              voiceError,
            );
          }
        }

        if (typeof missionOverride === "object") {
          throw error;
        }
      } finally {
        performanceMonitor.recordResponse(
          performance.now() -
            responseStartedAt,
        );

        setIsSending(false);
        scheduleAuraLiveListening();
      }
    },
    [
      executeActions,
      isSending,
      memory.preferredLocale,
      scheduleAuraLiveListening,
      speak,
      userContext,
      voiceMode,
    ],
  );

  if (!isLoaded) {
    return (
      <main
        className="flex min-h-screen items-center justify-center text-white"
        style={{
          backgroundColor:
            theme.colors.background,
        }}
      >
        {translate(
          memory.preferredLocale,
          "app.loading",
        )}
      </main>
    );
  }

  return (
    <I18nProvider
      locale={memory.preferredLocale}
    >
      <>
        {!memory.hasCompletedOnboarding && (
          <WelcomeOverlay
            userName={authenticatedDisplayName}
            onContinue={
              handleWelcomeContinue
            }
          />
        )}

        <VaeoraWorkspaceShell
          locale={memory.preferredLocale}
          userName={authenticatedDisplayName}
          initialView={initialView}
          activeView={
            activeWorkspaceView
          }
          onViewChange={
            setActiveWorkspaceView
          }
          presence={
            <>
              <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)]">
                <section className="order-2 min-w-0 rounded-[30px] border border-white/[0.07] bg-[#09090f] p-5 sm:p-7 xl:order-1">
                  <Hero
                    name={authenticatedDisplayName}
                  />

                  <AuraStartingPoints
                    disabled={
                      isSending
                    }
                    onSelect={
                      handleSend
                    }
                  />
                </section>

                <div className="order-1 min-w-0 space-y-5 xl:order-2">
                  <AssistantCard
                    onStart={
                      handleSend
                    }
                    isAuraLive={
                      isAuraLive
                    }
                    onToggleAuraLive={
                      toggleAuraLive
                    }
                  />

                  <section className="min-w-0 space-y-5 rounded-[28px] border border-white/[0.07] bg-[#09090f] p-4 sm:p-6">
                    <Conversation
                      conversationKey={activeProjectId}
                      messages={
                        visibleMessages
                      }
                      olderMessageCount={visibleStartIndex}
                      onLoadOlder={handleLoadOlderMessages}
                      animatedMessageIds={animatedMessageIds}
                      isThinking={
                        isSending
                      }
                      project={
                        activeProject
                      }
                      onOpenBranding={
                        activeProject
                          ? () =>
                              openCreativeStudio(
                                "direction",
                              )
                          : undefined
                      }
                      onChoose={
                        handleSend
                      }
                      onOpenSurface={
                        openExperienceSurface
                      }
                      isBusy={
                        isSending
                      }
                      navigationTargetMessageId={conversationNavigation.targetMessageId}
                      navigationRequestId={conversationNavigation.requestId}
                    />

                    <ChatInput
                      onSend={
                        handleSend
                      }
                      isSending={
                        isSending
                      }
                      voiceEntryRequested={
                        entryIntent ===
                        "voice"
                      }
                    />
                  </section>
                </div>
              </div>

              <div className="mt-6">
                <ActionCenter
                  history={
                    actionHistory
                  }
                  canUndoLast={
                    canUndoLast
                  }
                  onUndoLast={() => {
                    undoLast();
                  }}
                />
              </div>
            </>
          }
          projects={
            <section className="min-w-0 rounded-[30px] border border-white/[0.07] bg-[#09090f] p-4 sm:p-6">
              <Workspace
                entryIntent={
                  entryIntent
                }
                preferredLocale={
                  memory.preferredLocale
                }
                initialProject={
                  activeProject
                }
                studioRequest={
                  creativeStudioRequest
                }
                onProjectSelected={
                  handleWorkspaceProjectSelected
                }
                onContinueWithAura={handleContinueWithAura}
                onOpenIntelligence={() =>
                  setActiveWorkspaceView(
                    "intelligence",
                  )
                }
              />
            </section>
          }
          intelligence={
            <PersonalIntelligenceCenter
              requestedProjectId={activeProjectId}
              onResetMemory={resetMemory}
            />
          }
        />
      </>
    </I18nProvider>
  );
}
