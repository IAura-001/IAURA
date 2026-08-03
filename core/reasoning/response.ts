import type { ReasoningAnalysis } from "./analyzer";
import type { ResponseDecision } from "./decision";
import type { ReasoningPlan } from "./planner";

export interface ReasoningResponseContext {
  analysis: ReasoningAnalysis;
  plan: ReasoningPlan;
  decision: ResponseDecision;
}

function formatSteps(plan: ReasoningPlan): string {
  return plan.steps
    .map(
      (step, index) =>
        `${index + 1}. ${step.title}: ${step.purpose}`
    )
    .join("\n");
}

export function buildReasoningInstructions({
  analysis,
  plan,
  decision,
}: ReasoningResponseContext): string {
  return `
# DIRECCIÓN COGNITIVA DEL TURNO

Intención principal:
${analysis.primaryIntent}

Urgencia:
${analysis.urgency}

Complejidad:
${analysis.complexity}

Estrategia recomendada:
${plan.strategy}

Plan interno:
${formatSteps(plan)}

Decisión de respuesta:
- Profundidad: ${decision.depth}
- Formato: ${decision.format}
- Preguntar antes de responder: ${
    decision.shouldAskQuestion ? "sí" : "no"
  }
- Proponer una acción: ${
    decision.shouldRecommendAction ? "sí" : "no"
  }
- Máximo sugerido de pasos: ${
    decision.maximumSuggestedSteps
  }

Aplicación:

${
  plan.clarificationQuestion
    ? `Solicitar únicamente la aclaración necesaria: "${plan.clarificationQuestion}"`
    : "Entregar la respuesta con el formato, profundidad y límite de pasos indicados."
}
`.trim();
}
