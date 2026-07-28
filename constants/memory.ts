import type { Memory } from "@/types/memory";

export const DEFAULT_MEMORY: Memory = {
  id: "default",

  userName: "Diego",

  goals: [],

  habits: [],

  projects: ["IAURA"],

  completedMissions: 16,
  completedMissionIds: ["001", "002", "003", "004", "005"],

  streak: 16,

  level: 1,

  experience: 35,

  lastLogin: new Date().toISOString(),
};