import type { Memory } from "@/types/memory";
import { DEFAULT_LOCALE } from "@/core/i18n/languages";

export const DEFAULT_MEMORY: Memory = {
  id: "default",

  userName: "Diego",

  preferredLocale: DEFAULT_LOCALE,

  hasCompletedOnboarding: false,

  goals: [],

  habits: [],

  projects: ["IAURA"],

  activeProject: null,

  completedMissions: 0,
  completedMissionIds: [],

  streak: 0,

  level: 1,

  experience: 0,

  lastLogin: new Date().toISOString(),
};