import { retentionFlags } from "@/core/betaUsage/funnel";
import type { Beta2Dashboard, Beta2Participant, Beta2ParticipantFacts, Beta2ParticipantStatus } from "./types";

const DAY = 86_400_000;
const rate = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
const median = (values: number[]) => { const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!sorted.length) return null; const m=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[m] : (sorted[m-1]+sorted[m])/2; };

export function deriveParticipant(facts: Beta2ParticipantFacts, now = new Date()): Beta2Participant {
  const retention = facts.activatedAt ? retentionFlags(facts.activatedAt, facts.meaningfulSessionDates) : { d1:false,d7:false };
  const inactive = Boolean(facts.lastMeaningfulAt && now.getTime()-Date.parse(facts.lastMeaningfulAt)>7*DAY);
  let status: Beta2ParticipantStatus = "INVITED";
  if (facts.joinedAt) status="JOINED"; if (facts.firstIntentAt) status="STARTED";
  if (facts.activatedAt) status="ACTIVATED"; if (retention.d1 || retention.d7) status="RETURNING";
  if (facts.completedAt) status="COMPLETED"; else if (inactive) status="INACTIVE";
  const abandonment = !facts.joinedAt ? "INVITE_NO_SIGNUP" : !facts.firstIntentAt ? "SIGNUP_NO_INTENT"
    : !facts.projectCreatedAt ? "INTENT_NO_PROJECT" : !facts.firstResultAt ? "PROJECT_NO_RESULT"
      : !facts.milestones.length ? "RESULT_NO_DURABLE_OUTPUT" : facts.activatedAt && !retention.d1 &&
        now.getTime()-Date.parse(facts.activatedAt)>2*DAY ? "ACTIVATED_NO_D1" : retention.d1 && !retention.d7 &&
        now.getTime()-Date.parse(facts.activatedAt!)>9*DAY ? "D1_NO_D7" : inactive ? "PROGRESS_STALLED" : null;
  const minutesToActivation = facts.activatedAt && facts.joinedAt
    ? Math.max(0,(Date.parse(facts.activatedAt)-Date.parse(facts.joinedAt))/60_000) : null;
  return { ...facts,status,...retention,minutesToActivation,abandonment };
}
export function buildBeta2Dashboard(rows: Beta2ParticipantFacts[], now = new Date()): Beta2Dashboard {
  const participants=rows.map(row=>deriveParticipant(row,now));
  const count=(predicate:(p:Beta2Participant)=>boolean)=>participants.filter(predicate).length;
  const joined=count(p=>Boolean(p.joinedAt)), started=count(p=>Boolean(p.firstIntentAt));
  const projects=count(p=>Boolean(p.projectCreatedAt)), results=count(p=>Boolean(p.firstResultAt));
  const activated=count(p=>Boolean(p.activatedAt)), completed=count(p=>Boolean(p.completedAt));
  const totalAiCostUsd=participants.reduce((s,p)=>s+p.aiCostUsd,0);
  return { generatedAt:now.toISOString(),participants,summary:{ invited:participants.length,joined,started,activated,
    returning:count(p=>p.status==="RETURNING"||p.status==="COMPLETED"),completed,inactive:count(p=>p.status==="INACTIVE"),
    d1:count(p=>p.d1),d7:count(p=>p.d7),inviteToSignupRate:rate(joined,participants.length),
    signupToIntentRate:rate(started,joined),intentToProjectRate:rate(projects,started),projectToResultRate:rate(results,projects),
    activationRate:rate(activated,joined),completionRate:rate(completed,joined),
    medianMinutesToActivation:median(participants.flatMap(p=>p.minutesToActivation===null?[]:[p.minutesToActivation])),
    totalAiCostUsd,costPerActivatedUser:rate(totalAiCostUsd,activated),costPerCompletedUser:rate(totalAiCostUsd,completed),
    unpricedOperations:participants.reduce((s,p)=>s+p.unpricedOperations,0),failedOperations:participants.reduce((s,p)=>s+p.failedOperations,0),
    unresolvedFeedback:participants.reduce((s,p)=>s+p.unresolvedFeedback,0) } };
}
