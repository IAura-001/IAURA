import { BETA_FEEDBACK_CATEGORIES, BETA_FEEDBACK_KINDS, type BetaFeedbackCategory, type BetaFeedbackKind } from "./types";
export interface NormalizedBetaFeedback { category: BetaFeedbackCategory; kind: BetaFeedbackKind;
  projectId: string|null; rating: "yes"|"partly"|"no"|null; text: string|null; answers: Record<string,string>; }
export function normalizeBetaFeedback(value: unknown): NormalizedBetaFeedback|null {
  if (!value||typeof value!=="object"||Array.isArray(value)) return null; const body=value as Record<string,unknown>;
  if (!BETA_FEEDBACK_CATEGORIES.includes(body.category as BetaFeedbackCategory)||
    !BETA_FEEDBACK_KINDS.includes(body.kind as BetaFeedbackKind)) return null;
  const text=typeof body.text==="string"&&body.text.trim()?body.text.trim().slice(0,4000):null;
  const projectId=typeof body.projectId==="string"&&/^[a-zA-Z0-9_-]{1,200}$/.test(body.projectId)?body.projectId:null;
  const rating=body.rating==="yes"||body.rating==="partly"||body.rating==="no"?body.rating:null;
  const answers:Record<string,string>={}; if(body.answers&&typeof body.answers==="object"&&!Array.isArray(body.answers))
    for(const [key,item] of Object.entries(body.answers as Record<string,unknown>)) if(/^[a-z_]{1,60}$/.test(key)&&typeof item==="string"&&item.trim()) answers[key]=item.trim().slice(0,1000);
  if(!text&&!rating&&!Object.keys(answers).length) return null;
  return {category:body.category as BetaFeedbackCategory,kind:body.kind as BetaFeedbackKind,projectId,rating,text,answers};
}
