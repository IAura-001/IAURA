"use client";

import { conversationController } from "@/core/conversation";
import { generateAIResponse } from "@/services/ai";

import { generatePriorities } from "@/utils/intelligence";
import { generateRecommendation } from "@/utils/recommendations";
import { buildUserContext } from "@/utils/context";
import { buildPrompt } from "@/utils/prompt";
import { MISSIONS } from "@/constants/missions";
import { performanceMonitor } from "@/core/performance";
import { useVoiceContext } from "@/core/context/VoiceContext";
import { formatActionReceipt } from "@/core/actions";
import { theme } from "@/config/theme";
import AssistantCard from "@/components/sections/AssistantCard";
import AuraPresenceV2 from "@/components/aura/AuraPresenceV2";
import { ActionCenter } from "@/components/sections/ActionCenter";
import Hero from "@/components/sections/Hero";
import ModeSelector from "@/components/sections/ModeSelector";
import Navbar from "@/components/sections/Navbar";
import { AIActionBar } from "@/components/sections/AIActionBar";
import { ChatInput } from "@/components/sections/ChatInput";
import { Conversation } from "@/components/sections/Conversation";
import dynamic from "next/dynamic";
import type { ChatMessage } from "@/types/chat";
import type { BrandProfile } from "@/types/project";
import ProjectCard from "@/components/sections/ProjectCard";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { MODES } from "@/constants/modes";
import { useAuraActions } from "@/hooks/useAuraActions";
import { useMemory } from "@/hooks/useMemory";
import { cleanAIText } from "@/utils/formatText";
import {
  I18nProvider,
  useI18n,
} from "@/core/i18n/I18nContext";
import {
  translate,
  type MessageKey,
} from "@/core/i18n/messages";

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
  () => import("@/components/sections/DashboardPanel"),
  {
    loading: () => (
      <LocalizedLoading messageKey="loading.dashboard" />
    ),
  }
);
const AIAnalysisPanel = dynamic(
  () =>
    import(
      "@/components/sections/AIAnalysisPanel"
    ).then((module) => module.AIAnalysisPanel),
  {
    loading: () => (
      <LocalizedLoading messageKey="loading.analysis" />
    ),
  }
);

const BrandingStudio = dynamic(
  () =>
    import(
      "@/components/sections/BrandingStudio"
    ),
  {
    loading: () => (
      <LocalizedLoading messageKey="loading.branding" />
    ),
  }
);
export default function Home() {
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
  const [selectedMode, setSelectedMode] = useState("learn");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [openStudio, setOpenStudio] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

const [isSending, setIsSending] = useState(false);
const [isAuraLive, setIsAuraLive] =
  useState(false);
const auraLiveRef = useRef(false);
const auraLiveRestartTimerRef =
  useRef<number | null>(null);
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

useEffect(() => {
  if (!isLoaded) return;

  setLanguage(memory.preferredLocale);
  document.documentElement.lang =
    memory.preferredLocale;
}, [
  isLoaded,
  memory.preferredLocale,
  setLanguage,
]);

const activeProject = memory.activeProject;

const handleSaveBranding = useCallback(
  (branding: BrandProfile) => {
    if (!memory.activeProject) return;

    updateMemory({
      activeProject: {
        ...memory.activeProject,
        branding,
        updatedAt: branding.updatedAt,
      },
    });
  },
  [memory.activeProject, updateMemory]
);
const activeMode =
  MODES.find((mode) => mode.id === selectedMode) ?? MODES[0];

const completedMissionIds = memory.completedMissionIds ?? [];

const completedMissions = MISSIONS.filter((mission) =>
  completedMissionIds.includes(mission.id)
);

const pendingMissions = MISSIONS.filter(
  (mission) => !completedMissionIds.includes(mission.id)
);



const goals = memory.goals;

function handleAddGoal(goal: string) {
  updateMemory({
    goals: [...goals, goal],
  });
}

function handleRemoveGoal(goalIndex: number) {
  updateMemory({
    goals: goals.filter((_, index) => index !== goalIndex),
  });
}
const habits = memory.habits;
const scoredPriorities = generatePriorities(
  memory.goals,
  memory.habits
);

const intelligencePriorities =
  scoredPriorities.length > 0
    ? scoredPriorities.slice(0, 3)
    : [
        {
          title: translate(
            memory.preferredLocale,
            "priority.firstGoal"
          ),
          score: 100,
        },
        {
          title: translate(
            memory.preferredLocale,
            "priority.dailyHabit"
          ),
          score: 90,
        },
        {
          title: translate(
            memory.preferredLocale,
            "priority.nextMission"
          ),
          score: 80,
        },
      ];
      const userContext = buildUserContext(memory);

const recommendation = generateRecommendation(
  userContext,
  memory.preferredLocale
);

const prompt = buildPrompt(userContext);
const handleAnalyze = () => {
  setIsAnalyzing(true);
  setShowAnalysis(false);

  setTimeout(() => {
    const newAnalysis = generateAIResponse(prompt);

    setAnalysis(newAnalysis);
    setShowAnalysis(true);
    setIsAnalyzing(false);
  }, 700);
};

const stopAuraLive = useCallback(() => {
  auraLiveRef.current = false;
  setIsAuraLive(false);

  if (
    auraLiveRestartTimerRef.current !==
    null
  ) {
    window.clearTimeout(
      auraLiveRestartTimerRef.current
    );
    auraLiveRestartTimerRef.current = null;
  }

  stopContinuousListening();
  stopSpeaking();
}, [stopContinuousListening, stopSpeaking]);

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
        auraLiveRestartTimerRef.current
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

const toggleAuraLive = useCallback(() => {
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

useEffect(() => {
  return () => {
    if (
      auraLiveRestartTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        auraLiveRestartTimerRef.current
      );
    }
  };
}, []);

const handleSend = useCallback(
  async (missionOverride?: string) => {
  const trimmedInput = missionOverride?.trim();

if (!trimmedInput || isSending) {
  return;
}
const requestFromAuraLive =
  auraLiveRef.current;
const responseStartedAt = performance.now();

 
  
  const userMessage: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "user",
    content: trimmedInput,
    
  };

  setMessages((prev) => [...prev, userMessage]);

 
  setIsSending(true);

  try {
    const response = await conversationController.send(
  trimmedInput,
  prompt
);

const actionItems = executeActions(response.actions);
const actionReceipt = formatActionReceipt(actionItems);
const spokenContent = cleanAIText(
  response.content
);
const content = [
  spokenContent,
  actionReceipt,
]
  .filter(Boolean)
  .join("\n\n");
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "assistant",
      content,
    };

    setMessages((prev) => [...prev, assistantMessage]);

if (
  voiceMode &&
  (!requestFromAuraLive ||
    auraLiveRef.current)
) {
  const playback = speak(spokenContent);

  if (auraLiveRef.current) {
    try {
      await playback;
    } catch (error) {
      console.error(
        "IAURA voice playback failed:",
        error
      );
    }
  } else {
    void playback.catch((error) => {
      console.error(
        "IAURA voice playback failed:",
        error
      );
    });
  }
}
  } catch (error) {
  console.error("IAURA conversation failed:", error);

  const errorContent = translate(
    memory.preferredLocale,
    "error.conversation"
  );
  const errorMessage: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content: errorContent,
  };

  setMessages((prev) => [...prev, errorMessage]);

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
        voiceError
      );
    }
  }

  } finally {
  performanceMonitor.recordResponse(
    performance.now() - responseStartedAt
  );

  setIsSending(false);
  scheduleAuraLiveListening();
}
},
[executeActions, isSending, memory.preferredLocale, prompt, scheduleAuraLiveListening, voiceMode, speak]
);

  

function handleAddHabit(habit: string) {
  updateMemory({
    habits: [...habits, habit],
  });
}

function handleRemoveHabit(habitIndex: number) {
  updateMemory({
    habits: habits.filter((_, index) => index !== habitIndex),
  });
}
if (!isLoaded) {
  return (
    <main
      className="flex min-h-screen items-center justify-center text-white"
      style={{ backgroundColor: theme.colors.background }}
    >
      {translate(
        memory.preferredLocale,
        "app.loading"
      )}
    </main>
  );
}

return (
  <I18nProvider locale={memory.preferredLocale}>
  <main
    className="relative min-h-screen overflow-hidden px-4 text-white sm:px-6"
    style={{ backgroundColor: theme.colors.background }}
  >
      <div className="absolute left-[-150px] top-[-150px] h-[420px] w-[420px] rounded-full bg-purple-700/20 blur-[130px]" />

      <div className="absolute bottom-[-180px] right-[-120px] h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[130px]" />

      <Navbar />
      <div className="relative z-10 mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10">
  <AuraPresenceV2 />
</div>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-120px)] w-full min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 py-12 [&>*]:min-w-0 lg:grid-cols-2">
        <div>
          <Hero name={memory.userName} />

<div className="mt-8">
  {activeProject && (
  <div className="mt-8">
    <ProjectCard
  project={activeProject}
  onOpenStudio={(studio) => {
    setOpenStudio(studio);
  }}
/>{activeProject && openStudio === "branding" && (
  <BrandingStudio
    key={activeProject.id}
    project={activeProject}
    onSave={handleSaveBranding}
    onClose={() => setOpenStudio(null)}
  />
)}
  </div>
)}
</div>

<ModeSelector
  modes={MODES}
  selectedMode={selectedMode}
  onSelect={setSelectedMode}
/>
        </div>

<AssistantCard
  modeId={activeMode.id}
  onStart={handleSend}
  isAuraLive={isAuraLive}
  onToggleAuraLive={toggleAuraLive}
/>
<AIActionBar
  onAnalyze={handleAnalyze}
  isLoading={isAnalyzing}
/>
{showAnalysis && (
  <AIAnalysisPanel analysis={analysis} />
)}
<Conversation
  messages={messages}
  isThinking={isSending}
  project={activeProject}
  onOpenBranding={
    activeProject
      ? () => setOpenStudio("branding")
      : undefined
  }
/>

<ChatInput
  onSend={handleSend}
  isSending={isSending}
/>
<ActionCenter
  history={actionHistory}
  canUndoLast={canUndoLast}
  onUndoLast={() => {
    undoLast();
  }}
/>
<DashboardPanel
  name={memory.userName}
  preferredLocale={memory.preferredLocale}
  goals={goals}
  onSaveName={(name) =>
    updateMemory({
      userName: name,
    })
  }
  onLanguageChange={(preferredLocale) =>
    updateMemory({
      preferredLocale,
    })
  }
  onAddGoal={handleAddGoal}
  onRemoveGoal={handleRemoveGoal}
  habits={habits}
  onAddHabit={handleAddHabit}
  onRemoveHabit={handleRemoveHabit}
  priorities={intelligencePriorities}
  recommendation={recommendation}
  completedCount={completedMissions.length}
  totalMissions={MISSIONS.length}
  experience={memory.experience}
  onEarnXP={() => addExperience(25)}
  onResetMemory={resetMemory}
  messageCount={messages.length}
  goalsCount={memory.goals.length}
  habitsCount={memory.habits.length}
  missions={pendingMissions}
  completedMissionIds={memory.completedMissionIds ?? []}
  onMissionComplete={(missionId) =>
    markMissionComplete(missionId, 25)
  }
/>

    
      
      </section>
    </main>
  </I18nProvider>
  );
}
