import "server-only";
import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildBeta2Dashboard } from "./dashboard";
import type { Beta2ParticipantFacts } from "./types";
export class Beta2FounderAccessError extends Error {}
export class Beta2ServerError extends Error {}
interface RpcRow { user_id:string;email:string|null;invited_at:string;joined_at:string|null;first_intent_at:string|null;
 project_created_at:string|null;first_result_at:string|null;activated_at:string|null;meaningful_session_dates:string[]|null;
 last_meaningful_at:string|null;completed_at:string|null;milestones:Beta2ParticipantFacts["milestones"]|null;
 ai_cost_usd:number|string;unpriced_operations:number;failed_operations:number;entitlement_denials:number;unresolved_feedback:number; }
export async function getBeta2Dashboard() { const supabase=await createServerSupabaseClient();
 const [{data,error},{data:inviteData,error:inviteError}]=await Promise.all([
  supabase.rpc("founder_beta2_participants",{requested_cohort_id:"beta_2"}),supabase.rpc("founder_beta2_invite_summary")]);
 if(error?.code==="42501") throw new Beta2FounderAccessError(); if(error) throw new Beta2ServerError();
 if(inviteError?.code==="42501")throw new Beta2FounderAccessError();if(inviteError)throw new Beta2ServerError();
 const dashboard=buildBeta2Dashboard(((data??[]) as RpcRow[]).map(row=>({userId:row.user_id,email:row.email,invitedAt:row.invited_at,
  joinedAt:row.joined_at,firstIntentAt:row.first_intent_at,projectCreatedAt:row.project_created_at,firstResultAt:row.first_result_at,
  activatedAt:row.activated_at,meaningfulSessionDates:row.meaningful_session_dates??[],lastMeaningfulAt:row.last_meaningful_at,
  completedAt:row.completed_at,milestones:row.milestones??[],aiCostUsd:Number(row.ai_cost_usd)||0,
  unpricedOperations:Number(row.unpriced_operations)||0,failedOperations:Number(row.failed_operations)||0,
  entitlementDenials:row.entitlement_denials===null?null:Number(row.entitlement_denials)||0,unresolvedFeedback:Number(row.unresolved_feedback)||0})));
 const invite=inviteData as {invited?:number;joined?:number}|null;const invited=Number(invite?.invited)||dashboard.summary.invited;
 const joined=Number(invite?.joined)||dashboard.summary.joined;dashboard.summary.invited=invited;
 dashboard.summary.inviteToSignupRate=invited?joined/invited:null;return dashboard;
}
export function pseudonymousParticipantId(userId:string){return createHash("sha256").update(`beta2:${userId}`).digest("hex").slice(0,16);}
export function beta2Csv(dashboard:Awaited<ReturnType<typeof getBeta2Dashboard>>){
 const columns=["participant_id","status","d1","d7","minutes_to_activation","milestones","ai_cost_usd","unpriced_operations","failed_operations","unresolved_feedback","abandonment"];
 const escape=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;
 return [columns.join(","),...dashboard.participants.map(p=>[pseudonymousParticipantId(p.userId),p.status,p.d1,p.d7,p.minutesToActivation,
  p.milestones.join("|"),p.aiCostUsd,p.unpricedOperations,p.failedOperations,p.unresolvedFeedback,p.abandonment].map(escape).join(","))].join("\n");
}
export interface FounderBetaFeedback { id:string;participantUserId:string;kind:string;category:string;rating:string|null;
 severity:string|null;text:string|null;answers:Record<string,string>;createdAt:string;resolvedAt:string|null; }
export async function getFounderBeta2Feedback():Promise<FounderBetaFeedback[]>{const supabase=await createServerSupabaseClient();
 const {data,error}=await supabase.rpc("founder_beta2_feedback");if(error?.code==="42501")throw new Beta2FounderAccessError();
 if(error)throw new Beta2ServerError();return ((data??[]) as Array<Record<string,unknown>>).map(row=>({id:String(row.id),
 participantUserId:String(row.participant_user_id),kind:String(row.kind),category:String(row.category),
 rating:typeof row.rating==="string"?row.rating:null,severity:typeof row.severity==="string"?row.severity:null,
 text:typeof row.feedback_text==="string"?row.feedback_text:null,answers:(row.answers??{}) as Record<string,string>,
 createdAt:String(row.created_at),resolvedAt:typeof row.resolved_at==="string"?row.resolved_at:null}));}
