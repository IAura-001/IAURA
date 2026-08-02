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
# CONTEXTO DE RAZONAMIENTO PARA ESTA SOLICITUD

Intención principal:
${analysis.primaryIntent}

Objetivo interpretado:
${analysis.objective}

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

INSTRUCCIONES

Usa este análisis como orientación interna.

No menciones categorías técnicas como intención, urgencia, complejidad o motor de razonamiento.

No expongas el proceso interno paso por paso.

Entrega únicamente la respuesta final útil, natural y coherente con la identidad de IAURA.

${
  plan.clarificationQuestion
    ? `Si falta información esencial, pregunta únicamente: "${plan.clarificationQuestion}"`
    : "Termina con una recomendación o siguiente paso concreto cuando resulte útil."
}
`.trim();
}