import type { ReasoningAnalysis } from "./analyzer";

export interface ReasoningPlanStep {
  id: string;
  title: string;
  purpose: string;
}

export interface ReasoningPlan {
  objective: string;
  strategy: string;
  steps: ReasoningPlanStep[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

function createStrategy(analysis: ReasoningAnalysis): string {
  switch (analysis.primaryIntent) {
    case "decide":
      return "Definir las opciones, compararlas con criterios claros y recomendar el siguiente paso.";

    case "solve":
      return "Identificar la causa principal, validar el diagnóstico y aplicar la solución mínima efectiva.";

    case "create":
      return "Convertir la intención en una primera versión concreta y ejecutable.";

    case "plan":
      return "Organizar el objetivo en una secuencia priorizada y manejable.";

    case "execute":
      return "Reducir la planificación y comenzar por la acción que desbloquea más progreso.";

    case "evaluate":
      return "Establecer criterios, revisar evidencia y producir una conclusión útil.";

    case "improve":
      return "Detectar el mayor punto de fricción y priorizar la mejora con mayor impacto.";

    case "learn":
      return "Explicar el concepto, demostrarlo y convertirlo en práctica.";

    case "reflect":
      return "Ordenar lo que el usuario piensa o siente para descubrir una dirección más clara.";

    case "understand":
    default:
      return "Aclarar la solicitud, organizar la información y ofrecer una respuesta directamente útil.";
  }
}

function createSteps(
  analysis: ReasoningAnalysis
): ReasoningPlanStep[] {
  if (analysis.requiresClarification) {
    return [
      {
        id: "clarify",
        title: "Aclarar el resultado",
        purpose:
          "Obtener la información mínima necesaria antes de proponer una solución.",
      },
    ];
  }

  if (analysis.primaryIntent === "execute") {
    return [
      {
        id: "define-output",
        title: "Definir el resultado inmediato",
        purpose:
          "Precisar qué debe quedar terminado al completar esta acción.",
      },
      {
        id: "first-action",
        title: "Ejecutar el primer paso",
        purpose:
          "Comenzar por la acción que desbloquea el resto del trabajo.",
      },
      {
        id: "verify",
        title: "Verificar el resultado",
        purpose:
          "Confirmar que la acción produjo el efecto esperado.",
      },
    ];
  }

  return [
    {
      id: "understand",
      title: "Comprender",
      purpose:
        "Identificar el objetivo real, el contexto y el bloqueo principal.",
    },
    {
      id: "structure",
      title: "Estructurar",
      purpose:
        "Organizar la respuesta alrededor de la información que genera mayor claridad.",
    },
    {
      id: "advance",
      title: "Avanzar",
      purpose:
        "Definir una recomendación o siguiente acción concreta.",
    },
  ];
}

export function createReasoningPlan(
  analysis: ReasoningAnalysis
): ReasoningPlan {
  return {
    objective: analysis.objective,
    strategy: createStrategy(analysis),
    steps: createSteps(analysis),
    needsClarification: analysis.requiresClarification,
    clarificationQuestion: analysis.requiresClarification
      ? "¿Qué resultado concreto quieres obtener?"
      : undefined,
  };
}