import type { BrainContext } from "../brain/types";
import type {
  AutonomyAssessment,
  HumanDecisionGate,
} from "./types";

interface GateRule {
  gate: HumanDecisionGate;
  signals: RegExp[];
}

const HUMAN_GATE_RULES: GateRule[] = [
  {
    gate: "credentials_or_identity",
    signals: [
      /\bapi[\s_-]?key\b/i,
      /\bpassword\b/i,
      /\bcontrase(?:ñ|n)a\b/i,
      /\bcredential(?:s)?\b/i,
      /\bcredencial(?:es)?\b/i,
      /\bprivate key\b/i,
      /\bclave privada\b/i,
      /\b(?:2fa|otp)\b/i,
    ],
  },
  {
    gate: "financial_commitment",
    signals: [
      /\b(?:pay|payment|purchase|billing|subscribe)\b/i,
      /\b(?:pag|compr|factur|suscri)[a-záéíóúñü]*/i,
      /\b(?:pai|achet|abonn)[a-zàâçéèêëîïôûùüÿœæ]*/i,
      /\b(?:pag|compr|fatur|assin)[a-záâãàçéêíóôõú]*/i,
    ],
  },
  {
    gate: "external_commitment",
    signals: [
      /\b(?:send|publish|deploy|release|submit)\b/i,
      /\b(?:envi|public|despleg|lanz)[a-záéíóúñü]*/i,
      /\b(?:envoi|publi|déploi|lanc)[a-zàâçéèêëîïôûùüÿœæ]*/i,
      /\b(?:envi|public|implant|lanç)[a-záâãàçéêíóôõú]*/i,
    ],
  },
  {
    gate: "irreversible_action",
    signals: [
      /\b(?:delete|erase|remove permanently|terminate)\b/i,
      /\b(?:eliminar|borrar).*(?:permanente|cuenta|producci(?:ó|o)n)\b/i,
      /\b(?:supprimer|effacer).*(?:définitif|compte|production)\b/i,
      /\b(?:excluir|apagar).*(?:permanente|conta|produç(?:ã|a)o)\b/i,
    ],
  },
  {
    gate: "high_stakes",
    signals: [
      /\b(?:medical|legal|investment|tax advice)\b/i,
      /\b(?:médic|medic|legal|inversi(?:ó|o)n|impuesto)\w*\b/i,
      /\b(?:médical|juridique|investissement|impôt)\w*\b/i,
      /\b(?:médic|medic|jurídic|juridic|investimento|imposto)\w*\b/i,
    ],
  },
];

export function assessAutonomy(
  context: BrainContext
): AutonomyAssessment {
  const potentialHumanGates = HUMAN_GATE_RULES.filter(
    (rule) =>
      rule.signals.some((signal) =>
        signal.test(context.message)
      )
  ).map((rule) => rule.gate);

  return {
    mode: "supervised",
    defaultAction: "proceed",
    potentialHumanGates,
    reason:
      potentialHumanGates.length === 0
        ? "No human-only dependency was detected. Continue with safe, reversible work."
        : "A possible human-only dependency was detected. Continue with all safe work and pause only at the exact unresolved decision.",
  };
}
