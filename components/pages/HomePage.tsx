"use client";

import dynamic from "next/dynamic";
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
import { MISSIONS } from "@/constants/missions";

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
  useI18n,
} from "@/core/i18n/I18nContext";
import {
  translate,
  type MessageKey,
} from "@/core/i18n/messages";
import { performanceMonitor } from "@/core/performance";

import { useAuraActions } from "@/hooks/useAuraActions";
import { useMemory } from "@/hooks/useMemory";

import { generateAIResponse } from "@/services/ai";

import { buildUserContext } from "@/utils/context";
import { cleanAIText } from "@/utils/formatText";
import { generatePriorities } from "@/utils/intelligence";
import { buildPrompt } from "@/utils/prompt";
import { generateRecommendation } from "@/utils/recommendations";

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
import { AIActionBar } from "@/components/sections/AIActionBar";
import AssistantCard from "@/components/sections/AssistantCard";
import AuraStartingPoints from "@/components/sections/AuraStartingPoints";
import { ChatInput } from "@/components/sections/ChatInput";
import { Conversation } from "@/components/sections/Conversation";
import Hero from "@/components/sections/Hero";
import VaeoraWorkspaceShell, {
  type WorkspaceEntryIntent,
  type WorkspaceView,
} from "@/components/vaeora/VaeoraWorkspaceShell";
import WelcomeOverlay from "@/components/vaeora/WelcomeOverlay";

function LocalizedLoading({
  messageKey,
}: {
  messageKey: MessageKey;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
      {t(messageKey)}
    </div>
  );
}

const DashboardPanel = dynamic(
  () =>
    import(
      "@/components/sections/DashboardPanel"
    ),
  {
    loading: () => (
      <LocalizedLoading messageKey="loading.dashboard" />
    ),
  },
);

const AIAnalysisPanel = dynamic(
  () =>
    import(
      "@/components/sections/AIAnalysisPanel"
    ).then(
      (module) => module.AIAnalysisPanel,
    ),
  {
    loading: () => (
      <LocalizedLoading messageKey="loading.analysis" />
    ),
  },
);

interface HomePageProps {
  initialView?: WorkspaceView;
  entryIntent?: WorkspaceEntryIntent;
}

export default function Home({
  initialView = "presence",
  entryIntent,
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
    addExperience,
    markMissionComplete,
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

  const [showAnalysis, setShowAnalysis] =
    useState(false);
  const [analysis, setAnalysis] =
    useState("");
  const [
    activeWorkspaceView,
    setActiveWorkspaceView,
  ] = useState<WorkspaceView>(initialView);
  const [
    creativeStudioRequest,
    setCreativeStudioRequest,
  ] = useState<CreativeStudioRequest>();
  const [isAnalyzing, setIsAnalyzing] =
    useState(false);
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);
  const [visibleStartIndex, setVisibleStartIndex] =
    useState(0);
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

  const completedMissionIds =
    memory.completedMissionIds ?? [];

  const completedMissions =
    MISSIONS.filter((mission) =>
      completedMissionIds.includes(
        mission.id,
      ),
    );

  const pendingMissions =
    MISSIONS.filter(
      (mission) =>
        !completedMissionIds.includes(
          mission.id,
        ),
    );

  const goals = memory.goals;
  const habits = memory.habits;

  function handleAddGoal(goal: string) {
    updateMemory({
      goals: [...goals, goal],
    });
  }

  function handleRemoveGoal(
    goalIndex: number,
  ) {
    updateMemory({
      goals: goals.filter(
        (_, index) =>
          index !== goalIndex,
      ),
    });
  }

  function handleAddHabit(
    habit: string,
  ) {
    updateMemory({
      habits: [...habits, habit],
    });
  }

  function handleRemoveHabit(
    habitIndex: number,
  ) {
    updateMemory({
      habits: habits.filter(
        (_, index) =>
          index !== habitIndex,
      ),
    });
  }

  const scoredPriorities =
    generatePriorities(
      memory.goals,
      memory.habits,
    );

  const intelligencePriorities =
    scoredPriorities.length > 0
      ? scoredPriorities.slice(0, 3)
      : [
          {
            title: translate(
              memory.preferredLocale,
              "priority.firstGoal",
            ),
            score: 100,
          },
          {
            title: translate(
              memory.preferredLocale,
              "priority.dailyHabit",
            ),
            score: 90,
          },
          {
            title: translate(
              memory.preferredLocale,
              "priority.nextMission",
            ),
            score: 80,
          },
        ];

  const userContext =
    buildUserContext(memory);

  const visibleMessages = useMemo(
    () => visibleConversationMessages(messages, visibleStartIndex),
    [messages, visibleStartIndex],
  );
  const handleLoadOlderMessages = useCallback(() => {
    setVisibleStartIndex((current) => loadOlderConversationStart(current));
  }, []);

  const recommendation =
    generateRecommendation(
      userContext,
      memory.preferredLocale,
    );

  const prompt = buildPrompt();

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setShowAnalysis(false);

    window.setTimeout(async () => {
      try {
        const newAnalysis =
          await generateAIResponse(
            prompt,
            userContext,
          );

        setAnalysis(newAnalysis);
        setShowAnalysis(true);
      } catch (error) {
        console.error(
          "IAURA analysis generation failed:",
          error,
        );

        setAnalysis(
          "IAURA no pudo generar el análisis.",
        );
        setShowAnalysis(true);
      } finally {
        setIsAnalyzing(false);
      }
    }, 700);
  };

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
          };

        messageGenerationRef.current += 1;
        setAnimatedMessageIds((current) =>
          new Set([...current, assistantMessage.id]),
        );
        setMessages((previous) => [
          ...previous,
          assistantMessage,
        ]);

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
            userName={memory.userName}
            onContinue={
              handleWelcomeContinue
            }
          />
        )}

        <VaeoraWorkspaceShell
          locale={memory.preferredLocale}
          userName={memory.userName}
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
                    name={
                      memory.userName
                    }
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
                onContinueWithAura={() =>
                  setActiveWorkspaceView(
                    "presence",
                  )
                }
                onOpenIntelligence={() =>
                  setActiveWorkspaceView(
                    "intelligence",
                  )
                }
              />
            </section>
          }
          intelligence={
            <div className="min-w-0 space-y-6">
              <section className="min-w-0 rounded-[28px] border border-white/[0.07] bg-[#09090f] p-5 sm:p-6">
                <AIActionBar
                  onAnalyze={
                    handleAnalyze
                  }
                  isLoading={
                    isAnalyzing
                  }
                />

                {showAnalysis && (
                  <div className="mt-5">
                    <AIAnalysisPanel
                      analysis={
                        analysis
                      }
                    />
                  </div>
                )}
              </section>

              <section className="grid min-w-0 gap-5 [&>*]:min-w-0 md:grid-cols-2">
                <DashboardPanel
                  name={
                    memory.userName
                  }
                  preferredLocale={
                    memory.preferredLocale
                  }
                  goals={goals}
                  onSaveName={(
                    name,
                  ) =>
                    updateMemory({
                      userName: name,
                    })
                  }
                  onLanguageChange={(
                    preferredLocale,
                  ) =>
                    updateMemory({
                      preferredLocale,
                    })
                  }
                  onAddGoal={
                    handleAddGoal
                  }
                  onRemoveGoal={
                    handleRemoveGoal
                  }
                  habits={habits}
                  onAddHabit={
                    handleAddHabit
                  }
                  onRemoveHabit={
                    handleRemoveHabit
                  }
                  priorities={
                    intelligencePriorities
                  }
                  recommendation={
                    recommendation
                  }
                  completedCount={
                    completedMissions.length
                  }
                  totalMissions={
                    MISSIONS.length
                  }
                  experience={
                    memory.experience
                  }
                  onEarnXP={() =>
                    addExperience(25)
                  }
                  onResetMemory={
                    resetMemory
                  }
                  messageCount={
                    messages.length
                  }
                  goalsCount={
                    memory.goals
                      .length
                  }
                  habitsCount={
                    memory.habits
                      .length
                  }
                  missions={
                    pendingMissions
                  }
                  completedMissionIds={
                    memory.completedMissionIds ??
                    []
                  }
                  onMissionComplete={(
                    missionId,
                  ) =>
                    markMissionComplete(
                      missionId,
                      25,
                    )
                  }
                />
              </section>
            </div>
          }
        />
      </>
    </I18nProvider>
  );
}
