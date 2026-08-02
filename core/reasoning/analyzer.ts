export type ReasoningIntent =
  | "understand"
  | "learn"
  | "decide"
  | "solve"
  | "create"
  | "plan"
  | "execute"
  | "evaluate"
  | "improve"
  | "reflect";

export type ReasoningUrgency = "low" | "medium" | "high";

export type ReasoningComplexity = "simple" | "moderate" | "complex";

export interface ReasoningAnalysis {
  originalInput: string;
  normalizedInput: string;
  primaryIntent: ReasoningIntent;
  secondaryIntents: ReasoningIntent[];
  urgency: ReasoningUrgency;
  complexity: ReasoningComplexity;
  objective: string;
  requiresClarification: boolean;
  missingInformation: string[];
  relevantContext?: string;
}

export interface AnalyzeRequestOptions {
  context?: string;
}

const INTENT_PATTERNS: Record<ReasoningIntent, RegExp[]> = {
  understand: [
    /\bqué es\b/i,
    /\bexplica\b/i,
    /\bentender\b/i,
    /\bcomprender\b/i,
  ],
  learn: [
    /\baprender\b/i,
    /\benséñame\b/i,
    /\bcómo funciona\b/i,
    /\bpracticar\b/i,
  ],
  decide: [
    /\bdecidir\b/i,
    /\belegir\b/i,
    /\bcuál me conviene\b/i,
    /\bqué opción\b/i,
  ],
  solve: [
    /\bresolver\b/i,
    /\bproblema\b/i,
    /\berror\b/i,
    /\bno funciona\b/i,
    /\barreglar\b/i,
  ],
  create: [
    /\bcrear\b/i,
    /\bconstruir\b/i,
    /\bdiseñar\b/i,
    /\bgenerar\b/i,
    /\bhacer\b/i,
  ],
  plan: [
    /\bplan\b/i,
    /\bestrategia\b/i,
    /\borganizar\b/i,
    /\bruta\b/i,
  ],
  execute: [
    /\bejecutar\b/i,
    /\bempezar\b/i,
    /\bimplementar\b/i,
    /\bponer a funcionar\b/i,
    /\bhazlo\b/i,
  ],
  evaluate: [
    /\bevaluar\b/i,
    /\banalizar\b/i,
    /\bcomparar\b/i,
    /\brevisar\b/i,
  ],
  improve: [
    /\bmejorar\b/i,
    /\boptimizar\b/i,
    /\bperfeccionar\b/i,
    /\brefinar\b/i,
  ],
  reflect: [
    /\breflexionar\b/i,
    /\bqué pienso\b/i,
    /\bqué siento\b/i,
    /\bpor qué\b/i,
  ],
};

function detectIntents(input: string): ReasoningIntent[] {
  const matches = Object.entries(INTENT_PATTERNS)
    .filter(([, patterns]) =>
      patterns.some((pattern) => pattern.test(input))
    )
    .map(([intent]) => intent as ReasoningIntent);

  return matches.length > 0 ? matches : ["understand"];
}

function detectUrgency(input: string): ReasoningUrgency {
  if (
    /\b(urgente|ahora mismo|inmediatamente|ya|cuanto antes)\b/i.test(
      input
    )
  ) {
    return "high";
  }

  if (/\b(hoy|pronto|esta semana)\b/i.test(input)) {
    return "medium";
  }

  return "low";
}

function detectComplexity(input: string): ReasoningComplexity {
  const wordCount = input.trim().split(/\s+/).filter(Boolean).length;

  if (
    wordCount > 80 ||
    /\b(arquitectura|ecosistema|estrategia completa|múltiples fases)\b/i.test(
      input
    )
  ) {
    return "complex";
  }

  if (wordCount > 25) {
    return "moderate";
  }

  return "simple";
}

function extractObjective(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return "Comprender qué necesita el usuario.";
  }

  return cleaned.length > 180
    ? `${cleaned.slice(0, 177)}...`
    : cleaned;
}

export function analyzeRequest(
  input: string,
  options: AnalyzeRequestOptions = {}
): ReasoningAnalysis {
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const intents = detectIntents(normalizedInput);

  const requiresClarification =
    normalizedInput.length < 4 ||
    /^(esto|eso|aquello|hazlo|ayúdame)$/i.test(normalizedInput);

  return {
    originalInput: input,
    normalizedInput,
    primaryIntent: intents[0],
    secondaryIntents: intents.slice(1),
    urgency: detectUrgency(normalizedInput),
    complexity: detectComplexity(normalizedInput),
    objective: extractObjective(normalizedInput),
    requiresClarification,
    missingInformation: requiresClarification
      ? ["Falta definir con precisión el resultado esperado."]
      : [],
    relevantContext: options.context?.trim() || undefined,
  };
}