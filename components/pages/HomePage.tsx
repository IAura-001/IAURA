"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import type { ProjectThemeDNA } from "@/core/projectTheme/types";
import { projectEnvironmentContext, type ProjectEnvironmentContext } from "@/core/projectTheme/environmentContext";

import { theme } from "@/config/theme";
import {
  formatActionReceipt,
  type AuraExperienceChoice,
  type AuraExperienceSurface,
} from "@/core/actions";
import {
  conversationController,
  ConversationTurnError,
} from "@/core/conversation";
import {
  authenticatedConversationRepository as conversationRepository,
} from "@/core/conversation/AuthenticatedConversationRepository";
import { authenticatedProjectRepository } from "@/core/project/AuthenticatedProjectRepository";
import { projectEngine } from "@/core/project/ProjectEngine";
import { useAuthenticatedActiveProject } from "@/core/project/useAuthenticatedActiveProject";
import { useVoiceContext } from "@/core/context/VoiceContext";
import {
  I18nProvider,
} from "@/core/i18n/I18nContext";
import {
  translate,
} from "@/core/i18n/messages";
import { performanceMonitor } from "@/core/performance";
import { trackBetaUsage } from "@/core/betaUsage/client";
import { sonicEngine } from "@/core/sonic/SonicDNA";
import { activateHandsFreeVoice } from "@/core/voice/handsFreeActivation";

import { useAuraActions } from "@/hooks/useAuraActions";
import { useMemory } from "@/hooks/useMemory";

import { buildUserContext } from "@/utils/context";
import { cleanAIText } from "@/utils/formatText";

import Workspace from "@/components/pages/Workspace";
import {
  canApplyConversationHydration,
  canApplyConversationTurnResult,
  didActiveProjectChange,
  loadVisibleConversation,
} from "@/components/pages/conversationHydration";
import {
  initialConversationVisibleStart,
  loadOlderConversationStart,
  visibleConversationMessages,
} from "@/components/pages/conversationWindowing";
import { prepareIntelligenceBridgeAuthority } from "@/components/pages/intelligenceBridge";
import { ActionCenter } from "@/components/sections/ActionCenter";
import AssistantCard from "@/components/sections/AssistantCard";
import AuraStartingPoints from "@/components/sections/AuraStartingPoints";
import { ChatInput } from "@/components/sections/ChatInput";
import { Conversation } from "@/components/sections/Conversation";
import Hero from "@/components/sections/Hero";
import PersonalIntelligenceCenter, { type IntelligenceAuraBridgeRequest } from "@/components/sections/PersonalIntelligenceCenter";
import type { IntelligenceBridgeAuthority } from "@/core/conversation/ConversationController";
import VaeoraWorkspaceShell, {
  type WorkspaceEntryIntent,
  type WorkspaceView,
} from "@/components/vaeora/VaeoraWorkspaceShell";
import WelcomeOverlay from "@/components/vaeora/WelcomeOverlay";
import CommercialActivationGuide from "@/components/onboarding/CommercialActivationGuide";
import { commercialNextAction, provisionalLaunchName, shouldEnterCommercialOnboarding,
  type CommercialNextAction } from "@/core/onboarding/commercialOnboarding";
import { persistedLaunchMilestones } from "@/core/betaUsage/funnel";

interface HomePageProps {
  initialView?: WorkspaceView;
  entryIntent?: WorkspaceEntryIntent;
  authenticatedUserId?: string;
  authenticatedDisplayName?: string;
}

export default function Home({
  initialView = "presence",
  entryIntent,
  authenticatedUserId = "unauthenticated",
  authenticatedDisplayName = "",
}: HomePageProps) {
  const {
    state: voiceState,
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
    replaceMemory,
  } = useMemory();

  const activeProject = useAuthenticatedActiveProject();
  const activeProjectId = activeProject?.id ?? null;
  const [projectThemePreview, setProjectThemePreview] = useState<{
    projectId: string;
    theme: ProjectThemeDNA;
  } | null>(null);
  const [environmentContextPreview, setEnvironmentContextPreview] = useState<{
    projectId: string;
    context: ProjectEnvironmentContext;
  } | null>(null);
  const effectiveProjectTheme = activeProject
    ? projectThemePreview?.projectId === activeProject.id
      ? projectThemePreview.theme
      : activeProject.themeDNA ?? null
    : null;

  const {
    history: actionHistory,
    executeActions,
    canUndoLast,
    undoLast,
  } = useAuraActions({
    memory,
    userId: authenticatedUserId,
    activeProjectId,
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
  const [brandSystemRequest, setBrandSystemRequest] = useState<{ id: number; projectId: string }>();
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);
  const [messagesProjectId, setMessagesProjectId] =
    useState<string | null>(null);
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
  const [temporaryEnvironmentState, setTemporaryEnvironmentState] = useState<{
    projectId: string;
    context: Extract<ProjectEnvironmentContext, "completed" | "attention">;
  } | null>(null);
  const sendInFlightRef = useRef(false);
  const [isAuraLive, setIsAuraLive] =
    useState(false);
  const [intelligenceRefreshKey, setIntelligenceRefreshKey] = useState(0);
  const [directionPersistence, setDirectionPersistence] = useState<{
    projectId: string; status: "pending" | "saved" | "failed";
  } | null>(null);
  const [commercialLaunchPending, setCommercialLaunchPending] = useState(false);

  const auraLiveRef = useRef(false);
  const auraLiveRestartTimerRef =
    useRef<number | null>(null);
  const workspaceRequestIdRef = useRef(0);
  const activeProjectIdRef = useRef<string | null>(null);
  const messageGenerationRef = useRef(0);
  const wasSendingRef = useRef(false);
  const environmentTimerRef = useRef<number | null>(null);
  const commercialIntentTrackedRef = useRef(false);

  useEffect(() => {
    if (wasSendingRef.current && !isSending && activeProjectId) {
      if (voiceState !== "listening" && voiceState !== "speaking") {
        sonicEngine.playIaura("completion", effectiveProjectTheme);
      }
      setTemporaryEnvironmentState({ projectId: activeProjectId, context: "completed" });
      if (environmentTimerRef.current !== null) window.clearTimeout(environmentTimerRef.current);
      environmentTimerRef.current = window.setTimeout(() => {
        setTemporaryEnvironmentState(null);
        environmentTimerRef.current = null;
      }, 720);
    }
    wasSendingRef.current = isSending;
  }, [activeProjectId, effectiveProjectTheme, isSending, voiceState]);

  useEffect(() => {
    sonicEngine.setVoiceActive(voiceState === "listening" || voiceState === "speaking");
    return () => sonicEngine.setVoiceActive(false);
  }, [voiceState]);

  useEffect(() => () => {
    if (environmentTimerRef.current !== null) window.clearTimeout(environmentTimerRef.current);
  }, []);

  const livingEnvironmentContext = projectEnvironmentContext({
    activeView: activeWorkspaceView,
    voiceState,
    isSending,
    temporaryState: temporaryEnvironmentState?.projectId === activeProjectId
      ? temporaryEnvironmentState.context
      : null,
  });
  const effectiveLivingEnvironmentContext = activeProjectId && environmentContextPreview?.projectId === activeProjectId
    ? environmentContextPreview.context
    : livingEnvironmentContext;

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

  useLayoutEffect(() => {
    if (activeProjectIdRef.current !== activeProjectId) {
      activeProjectIdRef.current = activeProjectId;
      messageGenerationRef.current += 1;
    }
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
      setMessagesProjectId(requestedProjectId);
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

  const openProjectBrandSystem = useCallback(() => {
    if (!activeProjectId) return;
    workspaceRequestIdRef.current += 1;
    setActiveWorkspaceView("projects");
    setBrandSystemRequest({ id: workspaceRequestIdRef.current, projectId: activeProjectId });
  }, [activeProjectId]);

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
        setProjectThemePreview(null);
        setEnvironmentContextPreview(null);
        setTemporaryEnvironmentState(null);
        wasSendingRef.current = false;
        if (environmentTimerRef.current !== null) {
          window.clearTimeout(environmentTimerRef.current);
          environmentTimerRef.current = null;
        }
        const nextProjectId = project?.id ?? null;

        if (project) {
          authenticatedProjectRepository.setActiveProject(project);
        } else {
          authenticatedProjectRepository.clearActiveProject();
        }

        if (didActiveProjectChange(activeProjectId, nextProjectId)) {
          activeProjectIdRef.current = nextProjectId;
          messageGenerationRef.current += 1;
          setMessages([]);
          setMessagesProjectId(nextProjectId);
          setVisibleStartIndex(0);
          setAnimatedMessageIds(new Set());
          if (nextProjectId) {
            void trackBetaUsage({ type: "project_opened", projectId: nextProjectId });
          }
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
    () => messagesProjectId === activeProjectId
      ? visibleConversationMessages(messages, visibleStartIndex)
      : [],
    [activeProjectId, messages, messagesProjectId, visibleStartIndex],
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

  useEffect(() => {
    if (auraLiveRef.current) {
      stopAuraLive();
    }
  }, [activeProjectId, stopAuraLive]);

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
      activateHandsFreeVoice({
        setLive: setIsAuraLive,
        setVoiceMode,
        unlockAudio,
        startContinuousListening,
      });
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
      intelligenceBridgeAuthority?: IntelligenceBridgeAuthority,
      commercialOptions?: { firstIntentTracked?: boolean; throwOnFailure?: boolean },
    ) => {
      const trimmedInput =
        (typeof missionOverride === "string"
          ? missionOverride
          : missionOverride?.prompt
        )?.trim();

      if (
        !trimmedInput ||
        sendInFlightRef.current
      ) {
        return;
      }

      sonicEngine.play("confirm", effectiveProjectTheme);
      sendInFlightRef.current = true;

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

      const requestedProjectId = intelligenceBridgeAuthority?.scopeType === "project"
        ? intelligenceBridgeAuthority.projectId
        : activeProjectId;
      messageGenerationRef.current += 1;
      const requestedMessageGeneration = messageGenerationRef.current;
      setMessagesProjectId(requestedProjectId);
      setAnimatedMessageIds((current) =>
        messagesProjectId === requestedProjectId
          ? new Set([...current, userMessage.id])
          : new Set([userMessage.id]),
      );
      setMessages((previous) =>
        messagesProjectId === requestedProjectId
          ? [...previous, userMessage]
          : [userMessage],
      );

      setIsSending(true);

      if (!commercialOptions?.firstIntentTracked) {
        void trackBetaUsage({
          type: "first_intent_submitted",
          eventKey: "first_intent:first",
          source: requestedProjectId ? "project" : "presence",
          inputMode: requestFromAuraLive ? "voice" : "text",
          projectId: requestedProjectId,
        });
      }

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
                intelligenceBridgeAuthority,
              );
        const response = turn.plan;

        if (
          typeof missionOverride === "object" &&
          missionOverride.confirmation?.kind === "intelligence-action" &&
          missionOverride.confirmation.decision === "confirm" &&
          /Status:\s*executed/i.test(response.content)
        ) {
          setIntelligenceRefreshKey((current) => current + 1);
        }

        if (!canApplyConversationTurnResult({
          requestedProjectId,
          activeProjectId: activeProjectIdRef.current,
          requestedMessageGeneration,
          currentMessageGeneration: messageGenerationRef.current,
        })) {
          return;
        }

        void trackBetaUsage({ type: "message_sent", projectId: requestedProjectId });
        if (requestedProjectId) {
          void trackBetaUsage({
            type: "project_scoped_result",
            projectId: requestedProjectId,
            eventKey: `project_result:${turn.assistantMessageId}`,
            source: "conversation",
          });
          const milestone = typeof missionOverride === "object"
            ? missionOverride.confirmation?.kind
            : undefined;
          if (milestone) {
            void trackBetaUsage({
              type: "beta_step_completed", projectId: requestedProjectId, milestone,
            });
          }
          if (milestone === "beta-session-decision" || milestone === "beta-next-step") {
            void trackBetaUsage({
              type: "durable_output", projectId: requestedProjectId,
              eventKey: `durable:${requestedProjectId}:confirmed_next_action:${sourceMessageId ?? turn.assistantMessageId}`,
              source: "conversation", durableKind: "confirmed_next_action",
            });
          }
        }

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
            requestedProjectId,
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
        if (!canApplyConversationTurnResult({
          requestedProjectId,
          activeProjectId: activeProjectIdRef.current,
          requestedMessageGeneration,
          currentMessageGeneration: messageGenerationRef.current,
        })) {
          return;
        }

        console.error(
          "IAURA conversation failed:",
          error,
        );

        const errorContent = error instanceof ConversationTurnError &&
          error.code === "IAURA_CONVERSATION_STALE_CONFIRMATION"
          ? error.message
          : translate(
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

        if (typeof missionOverride === "object" || commercialOptions?.throwOnFailure) {
          throw error;
        }
      } finally {
        sendInFlightRef.current = false;
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
      activeProjectId,
      effectiveProjectTheme,
      memory.preferredLocale,
      messagesProjectId,
      scheduleAuraLiveListening,
      speak,
      userContext,
      voiceMode,
    ],
  );

  const handleCommercialLaunch = useCallback(async (intent: string) => {
    setCommercialLaunchPending(true);
    if (!commercialIntentTrackedRef.current) {
      commercialIntentTrackedRef.current = true;
      void trackBetaUsage({
        type: "first_intent_submitted", eventKey: "first_intent:first",
        source: "presence", inputMode: "text",
      });
    }
    const existingProject = projectEngine.findEquivalentProject(provisionalLaunchName(intent));
    const project = projectEngine.createProject({
      name: provisionalLaunchName(intent), goal: intent, kind: "business",
      commercialOnboarding: { version: 1, source: "first-launch" },
    });
    if (existingProject) authenticatedProjectRepository.retryProjectPersistence(project);
    await authenticatedProjectRepository.flush();
    if (!authenticatedProjectRepository.getLastOperationResult().ok) {
      throw new Error("The project could not be saved. Check your connection and retry.");
    }
    handleWorkspaceProjectSelected(project);
    updateMemory({ hasCompletedOnboarding: true, activeProject: project });
    setActiveWorkspaceView("presence");
    await handleSend(intent, undefined, { scopeType: "project", projectId: project.id }, {
      firstIntentTracked: true, throwOnFailure: true,
    });
    setCommercialLaunchPending(false);
  }, [handleSend, handleWorkspaceProjectSelected, updateMemory]);

  const handleCommercialSkip = useCallback(() => {
    setCommercialLaunchPending(false);
    handleWelcomeContinue();
  }, [handleWelcomeContinue]);

  const handleSaveCommercialDirection = useCallback(async () => {
    if (!activeProject?.commercialOnboarding) return;
    setDirectionPersistence({ projectId: activeProject.id, status: "pending" });
    const updated = projectEngine.updateProject(activeProject.id, {
      commercialOnboarding: {
        ...activeProject.commercialOnboarding,
        directionConfirmedAt: new Date().toISOString(),
      },
    });
    await authenticatedProjectRepository.flush();
    if (!authenticatedProjectRepository.getLastOperationResult().ok) {
      setDirectionPersistence({ projectId: activeProject.id, status: "failed" });
      throw new Error("The direction could not be saved. Please retry.");
    }
    setDirectionPersistence({ projectId: activeProject.id, status: "saved" });
    updateMemory({ activeProject: updated });
  }, [activeProject, updateMemory]);

  const handleCommercialNextAction = useCallback((action: CommercialNextAction) => {
    if (action === "build-brand-system") return openProjectBrandSystem();
    if (action === "approve-first-visual") return openCreativeStudio("image");
    if (action === "develop-website-messaging") return openCreativeStudio("website");
    setActiveWorkspaceView("presence");
  }, [openCreativeStudio, openProjectBrandSystem]);

  const projects = projectEngine.getProjects();
  const showCommercialOnboarding = commercialLaunchPending || shouldEnterCommercialOnboarding(
    memory.hasCompletedOnboarding, projects,
  );
  const isCommercialLaunch = activeProject?.commercialOnboarding?.source === "first-launch";
  const hasCommercialResult = Boolean(activeProject && messagesProjectId === activeProject.id &&
    messages.some((message) => message.role === "assistant" && Boolean(message.experience)));
  const directionState = directionPersistence && directionPersistence.projectId === activeProject?.id
    ? directionPersistence.status : null;
  const hasCommercialDurableOutput = Boolean(activeProject && directionState !== "pending" &&
    directionState !== "failed" && persistedLaunchMilestones(activeProject).length > 0);

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
        {showCommercialOnboarding && (
          <WelcomeOverlay
            userName={authenticatedDisplayName}
            onLaunch={handleCommercialLaunch}
            onSkip={handleCommercialSkip}
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
          activeProjectId={activeProjectId}
          projectThemeDNA={effectiveProjectTheme}
          environmentContext={effectiveLivingEnvironmentContext}
          presence={
            <>
              <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)]">
                <section className="order-2 min-w-0 rounded-[30px] border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface,var(--vaeora-surface))] p-5 text-[var(--project-text,var(--vaeora-text))] sm:p-7 xl:order-1">
                  <Hero
                    name={authenticatedDisplayName}
                  />

                  <AuraStartingPoints
                    key={activeProjectId ?? "general"}
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
                    key={activeProjectId ?? "general"}
                    onStart={
                      handleSend
                    }
                    isAuraLive={
                      isAuraLive
                    }
                    onToggleAuraLive={
                      toggleAuraLive
                    }
                    sonicTheme={effectiveProjectTheme}
                  />

                  <section className="min-w-0 space-y-5 rounded-[28px] border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface,var(--vaeora-surface))] p-4 sm:p-6">
                    {isCommercialLaunch && activeProject ? (
                      <CommercialActivationGuide
                        hasProjectResult={hasCommercialResult}
                        hasDurableDirection={hasCommercialDurableOutput}
                        nextAction={commercialNextAction(activeProject)}
                        isBusy={isSending}
                        onSaveDirection={handleSaveCommercialDirection}
                        onNextAction={handleCommercialNextAction}
                      />
                    ) : null}
                    <Conversation
                      conversationKey={activeProjectId}
                      messages={
                        visibleMessages
                      }
                      olderMessageCount={visibleStartIndex}
                      onLoadOlder={handleLoadOlderMessages}
                      animatedMessageIds={animatedMessageIds}
                      isThinking={
                        isSending && messagesProjectId === activeProjectId
                      }
                      project={
                        activeProject
                      }
                      onOpenBranding={
                        activeProject
                          ? openProjectBrandSystem
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
                      key={activeProjectId ?? "general"}
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
            <section className="min-w-0 rounded-[30px] border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface,var(--vaeora-surface))] p-4 sm:p-6">
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
                brandSystemRequest={brandSystemRequest}
                onProjectSelected={
                  handleWorkspaceProjectSelected
                }
                onContinueWithAura={handleContinueWithAura}
                onOpenIntelligence={() =>
                  setActiveWorkspaceView(
                    "intelligence",
                  )
                }
                environmentThemeDNA={effectiveProjectTheme ?? undefined}
                onThemePreviewChange={(nextTheme) => {
                  setProjectThemePreview(
                    activeProjectId && nextTheme
                      ? { projectId: activeProjectId, theme: nextTheme }
                      : null,
                  );
                }}
                onEnvironmentContextPreview={(context) => {
                  setEnvironmentContextPreview(activeProjectId && context
                    ? { projectId: activeProjectId, context }
                    : null);
                }}
              />
            </section>
          }
          intelligence={
            <PersonalIntelligenceCenter
              requestedProjectId={activeProjectId}
              refreshKey={intelligenceRefreshKey}
              onShapeWithAura={async (request: IntelligenceAuraBridgeRequest) => {
                if (!await prepareIntelligenceBridgeAuthority(request, authenticatedProjectRepository)) return;
                setActiveWorkspaceView("presence");
                await handleSend(request.prompt, undefined, request);
              }}
            />
          }
        />
      </>
    </I18nProvider>
  );
}
