import type { AppMode } from "@/types/app";

export const MODES: AppMode[] = [
  {
    id: "learn",
    name: "Aprender",
    icon: "✦",
    description: "Aura te guía con preguntas, pistas y práctica.",
  },
  {
    id: "build",
    name: "Construir",
    icon: "◯",
    description: "Convierte una idea en un proyecto ejecutable.",
  },
  {
    id: "founder",
    name: "Founder",
    icon: "◇",
    description: "Estrategia, decisiones y progreso para IAURA.",
  },
  {
    id: "solve",
    name: "Resolver",
    icon: "◈",
    description: "Obtén ayuda directa cuando necesitas avanzar rápido.",
  },
];