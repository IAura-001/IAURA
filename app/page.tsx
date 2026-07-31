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
import { ProjectEngine } from "@/core/project";
import { theme } from "@/config/theme";
import AssistantCard from "@/components/sections/AssistantCard";
import Hero from "@/components/sections/Hero";
import ModeSelector from "@/components/sections/ModeSelector";
import Navbar from "@/components/sections/Navbar";
import { AIActionBar } from "@/components/sections/AIActionBar";
import { ChatInput } from "@/components/sections/ChatInput";
import { Conversation } from "@/components/sections/Conversation";
import dynamic from "next/dynamic";
import type { ChatMessage } from "@/types/chat";
import ProjectCard from "@/components/sections/ProjectCard";
import {
  useCallback,
  useState,
} from "react";

import type { IAuraProject } from "@/types/project";
import { MODES } from "@/constants/modes";
import { useMemory } from "@/hooks/useMemory";
import { cleanAIText } from "@/utils/formatText";
const DashboardPanel = dynamic(
  () => import("@/components/sections/DashboardPanel"),
  {
    loading: () => (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-500">
        Loading IAURA dashboard...
      </div>
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
        Loading analysis...
      </div>
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
        Loading Branding Studio...
      </div>
    ),
  }
);
const projectEngine = new ProjectEngine();
export default function Home() {
const {
  speak,
  voiceMode,
} = useVoiceContext();  
  const [selectedMode, setSelectedMode] = useState("learn");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState("");
 
const [activeProject, setActiveProject] =
  useState<IAuraProject | null>(null);
  const [openStudio, setOpenStudio] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

const [isSending, setIsSending] = useState(false);
const {
  memory,
  isLoaded,
  updateMemory,
  addExperience,
  markMissionComplete,
  resetMemory,
} = useMemory();
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
          title: "Add your first goal",
          score: 100,
        },
        {
          title: "Create a daily habit",
          score: 90,
        },
        {
          title: "Complete your next IAURA mission",
          score: 80,
        },
      ];
      const userContext = buildUserContext(memory);

const recommendation = generateRecommendation(userContext);

const prompt = buildPrompt(userContext);
function createProjectFromIdea(idea: string): IAuraProject {
  const cleanedIdea = idea
    .replace(/quiero crear/gi, "")
    .replace(/quiero hacer/gi, "")
    .replace(/quiero construir/gi, "")
    .trim();

  const projectName =
    cleanedIdea
      .split(" ")
      .slice(0, 4)
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ") || "Nuevo Proyecto";

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: projectName,
    description: idea,
    goal: `Convertir esta idea en un proyecto real.`,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "planning",
    studios: {
      branding: true,
      website: true,
      app: false,
      marketing: true,
      documents: true,
    },
  };
}
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
const handleSend = useCallback(
  async (missionOverride?: string) => {
  const trimmedInput = missionOverride?.trim();

if (!trimmedInput || isSending) {
  return;
}
const responseStartedAt = performance.now();

 
  
const lowerInput = trimmedInput.toLowerCase();

const isProjectIdea =
  lowerInput.includes("quiero crear") ||
  lowerInput.includes("quiero hacer") ||
  lowerInput.includes("quiero construir");

if (isProjectIdea) {
  const newProject = createProjectFromIdea(trimmedInput);

  projectEngine.setCurrentProject(newProject);
  setActiveProject(newProject);
}
  const userMessage: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "user",
    content: trimmedInput,
    
  };

  setMessages((prev) => [...prev, userMessage]);

 
  setIsSending(true);

  try {
    const rawContent = await conversationController.send(
  trimmedInput,
  prompt
);

const content = cleanAIText(rawContent);
console.log("VOICE MODE:", voiceMode);
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "assistant",
      content,
    };

    setMessages((prev) => [...prev, assistantMessage]);

if (voiceMode) {
  speak(content);
}
  } catch (error) {
  console.error("IAURA conversation failed:", error);

  const errorMessage: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content:
      "No pude completar la solicitud en este momento. Inténtalo nuevamente.",
  };

  setMessages((prev) => [...prev, errorMessage]);

  } finally {
  performanceMonitor.recordResponse(
    performance.now() - responseStartedAt
  );

  setIsSending(false);
}
},
[isSending, prompt, voiceMode, speak]
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
      Loading IAURA...
    </main>
  );
}

return (
  <main
    className="relative min-h-screen overflow-hidden px-6 text-white"
    style={{ backgroundColor: theme.colors.background }}
  >
      <div className="absolute left-[-150px] top-[-150px] h-[420px] w-[420px] rounded-full bg-purple-700/20 blur-[130px]" />

      <div className="absolute bottom-[-180px] right-[-120px] h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[130px]" />

      <Navbar />

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-6xl items-center gap-14 py-12 lg:grid-cols-2">
        <div>
          <Hero />

<div className="mt-8">
  {activeProject && (
  <div className="mt-8">
    <ProjectCard
  project={activeProject}
  onOpenStudio={(studio) => {
    setOpenStudio(studio);
  }}
/>{activeProject && openStudio === "branding" && (
  <BrandingStudio project={activeProject} />
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
  modeName={activeMode.name}
  modeIcon={activeMode.icon}
  onStart={handleSend}
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
/>

<ChatInput
  onSend={handleSend}
  isSending={isSending}
/>
<DashboardPanel
  name={memory.userName}
  goals={goals}
  onSaveName={(name) =>
    updateMemory({
      userName: name,
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
  );
}