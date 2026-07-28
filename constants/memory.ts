import type { Memory } from "@/types/memory";

export const DEFAULT_MEMORY: Memory = {
  id: "default",

  userName: "Diego",

  goals: [],

  habits: [],

  projects: ["IAURA"],

  completedMissions: 0,
 completedMissionIds: [],

  streak: 0,

  level: 1,

  experience: 0,

  lastLogin: new Date().toISOString(),
};