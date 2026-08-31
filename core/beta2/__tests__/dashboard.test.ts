import { describe,expect,it } from "vitest";import { buildBeta2Dashboard,deriveParticipant } from "../dashboard";
import type { Beta2ParticipantFacts } from "../types";
const now=new Date("2026-08-30T12:00:00Z");const row=(o:Partial<Beta2ParticipantFacts>={}):Beta2ParticipantFacts=>({userId:"u1",email:null,invitedAt:"2026-08-20T00:00:00Z",joinedAt:null,firstIntentAt:null,projectCreatedAt:null,firstResultAt:null,activatedAt:null,meaningfulSessionDates:[],lastMeaningfulAt:null,completedAt:null,milestones:[],aiCostUsd:0,unpricedOperations:0,failedOperations:0,entitlementDenials:0,unresolvedFeedback:0,...o});
describe("Beta 2 lifecycle and reporting",()=>{
 it("derives invited, joined, started, activated, returning, and completed from facts",()=>{
  expect(deriveParticipant(row(),now).status).toBe("INVITED");expect(deriveParticipant(row({joinedAt:"2026-08-20T01:00:00Z"}),now).status).toBe("JOINED");
  expect(deriveParticipant(row({joinedAt:"2026-08-20T01:00:00Z",firstIntentAt:"2026-08-20T01:01:00Z"}),now).status).toBe("STARTED");
  const activated=row({joinedAt:"2026-08-20T01:00:00Z",firstIntentAt:"2026-08-20T01:01:00Z",activatedAt:"2026-08-20T01:04:00Z",meaningfulSessionDates:["2026-08-21"]});
  expect(deriveParticipant(activated,now)).toMatchObject({status:"RETURNING",d1:true,d7:false,minutesToActivation:4});
  expect(deriveParticipant({...activated,completedAt:"2026-08-27T00:00:00Z"},now).status).toBe("COMPLETED");
 });
 it("does not fabricate D1 or D7 before exact UTC windows",()=>{const p=deriveParticipant(row({joinedAt:"2026-08-20T00:00:00Z",activatedAt:"2026-08-20T12:00:00Z",meaningfulSessionDates:["2026-08-20","2026-08-22","2026-08-26","2026-08-29"]}),now);expect(p.d1).toBe(false);expect(p.d7).toBe(true);});
 it("identifies each authoritative abandonment step",()=>{expect(deriveParticipant(row(),now).abandonment).toBe("INVITE_NO_SIGNUP");expect(deriveParticipant(row({joinedAt:"2026-08-20T00:00:00Z"}),now).abandonment).toBe("SIGNUP_NO_INTENT");expect(deriveParticipant(row({joinedAt:"2026-08-20T00:00:00Z",firstIntentAt:"2026-08-20T00:01:00Z"}),now).abandonment).toBe("INTENT_NO_PROJECT");});
 it("calculates conversions, median Aha, cost and unpriced operations without treating missing prices as free",()=>{const data=buildBeta2Dashboard([row({userId:"a",joinedAt:"2026-08-20T00:00:00Z",firstIntentAt:"2026-08-20T00:01:00Z",projectCreatedAt:"2026-08-20T00:02:00Z",firstResultAt:"2026-08-20T00:03:00Z",activatedAt:"2026-08-20T00:04:00Z",aiCostUsd:2,unpricedOperations:1}),row({userId:"b",joinedAt:"2026-08-20T00:00:00Z",firstIntentAt:"2026-08-20T00:02:00Z",aiCostUsd:1})],now);expect(data.summary).toMatchObject({inviteToSignupRate:1,signupToIntentRate:1,intentToProjectRate:.5,projectToResultRate:1,activationRate:.5,medianMinutesToActivation:4,totalAiCostUsd:3,costPerActivatedUser:3,unpricedOperations:1});});
});
