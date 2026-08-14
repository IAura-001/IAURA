import type { ChatMessage } from "@/types/chat";
import type { ConversationRepository } from "@/core/conversation";
import { cleanAIText } from "@/utils/formatText";

export function didActiveProjectChange(
  previousProjectId: string | null,
  nextProjectId: string | null,
): boolean {
  return previousProjectId !== nextProjectId;
}

export function canApplyConversationHydration(input: {
  requestedProjectId: string | null;
  activeProjectId: string | null;
  scheduledMessageGeneration: number;
  currentMessageGeneration: number;
}): boolean {
  return (
    input.requestedProjectId === input.activeProjectId &&
    input.scheduledMessageGeneration === input.currentMessageGeneration
  );
}

export function loadVisibleConversation(
  conversations: Pick<ConversationRepository, "getActiveConversation">,
  projectId: string | null,
): ChatMessage[] {
  const conversation = conversations.getActiveConversation(projectId);
  const workflows = [
    ...(conversation?.completedBetaWorkflows ?? []),
    ...(conversation?.betaWorkflow ? [conversation.betaWorkflow] : []),
  ];
  const closedReviewTargets = new Map(
    workflows.flatMap((workflow) => {
      if (workflow.status !== "closed" || !workflow.sessionEvaluation) return [];
      const targetId = workflow.postClosureHandoff?.sourceMessageId ??
        conversation?.messages.findLast((message) => message.role === "assistant")?.messageId;
      return targetId ? [[targetId, workflow] as const] : [];
    }),
  );

  return conversation?.messages.map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.role === "assistant"
      ? cleanAIText(message.content)
      : message.content,
    ...(message.role === "assistant" &&
    message.structuredResponse?.experience
      ? { experience: message.structuredResponse.experience }
      : {}),
    ...(message.role === "assistant" &&
    message.structuredResponse?.betaNextStep
      ? { betaNextStep: message.structuredResponse.betaNextStep }
      : {}),
    ...(message.role === "assistant" &&
    message.structuredResponse?.betaExecutionEvaluation
      ? {
          betaExecutionEvaluation:
            message.structuredResponse.betaExecutionEvaluation,
        }
      : {}),
    ...(message.role === "assistant" &&
    message.structuredResponse?.betaSessionEvaluation
      ? { betaSessionEvaluation: message.structuredResponse.betaSessionEvaluation }
      : {}),
    ...(message.role === "assistant" &&
    workflows.some(
      (workflow) => workflow.sessionEvaluation?.sourceMessageId === message.messageId,
    )
      ? {
          betaSessionEvaluation: {
            outcomeSatisfied: workflows.find(
              (workflow) => workflow.sessionEvaluation?.sourceMessageId === message.messageId,
            )!.sessionEvaluation!.outcomeSatisfied,
            summary: workflows.find(
              (workflow) => workflow.sessionEvaluation?.sourceMessageId === message.messageId,
            )!.sessionEvaluation!.summary,
          },
          betaSessionEvaluationConfirmed: true,
        }
      : {}),
    ...(message.role === "assistant" &&
    closedReviewTargets.has(message.messageId)
      ? {
          betaSessionEvaluation: {
            outcomeSatisfied: closedReviewTargets.get(message.messageId)!
              .sessionEvaluation!.outcomeSatisfied,
            summary: closedReviewTargets.get(message.messageId)!
              .sessionEvaluation!.summary,
          },
          betaSessionEvaluationConfirmed: true,
          betaSessionClosed: true,
          ...(closedReviewTargets.get(message.messageId)!.postClosureHandoff
            ? {
                betaPostClosureDecision: closedReviewTargets.get(message.messageId)!
                  .postClosureHandoff!.decision,
              }
            : {}),
        }
      : {}),
    ...(message.role === "assistant" &&
    workflows.some((workflow) => workflow.verifiedExecutions?.some(
      (evidence) => evidence.sourceMessageId === message.messageId))
      ? { betaExecutionVerified: true }
      : {}),
    ...(message.role === "assistant" &&
    workflows.some((workflow) => workflow.incompleteExecutionRecoveries?.some(
      (recovery) => recovery.sourceMessageId === message.messageId))
      ? {
          betaIncompleteExecutionRecoveryDecision: workflows.find((workflow) =>
            workflow.incompleteExecutionRecoveries?.some(
              (recovery) => recovery.sourceMessageId === message.messageId,
            ))!.incompleteExecutionRecoveries!.find(
              (recovery) => recovery.sourceMessageId === message.messageId,
            )!.decision,
        }
      : {}),
    ...(message.role === "assistant" &&
    workflows.some(
      (workflow) => workflow.confirmedNextStep?.sourceMessageId === message.messageId,
    )
      ? { betaNextStepConfirmed: true }
      : {}),
    ...(message.role === "assistant" &&
    workflows.some((workflow) =>
      workflow.confirmedNextStep?.sourceMessageId === message.messageId &&
      workflow.sessionDecision)
      ? {
          betaSessionDecision: workflows.find((workflow) =>
            workflow.confirmedNextStep?.sourceMessageId === message.messageId &&
            workflow.sessionDecision)!.sessionDecision!.kind,
        }
      : {}),
    ...(message.role === "assistant" &&
    workflows.some((workflow) =>
      workflow.sessionDecision?.sourceMessageId === message.messageId &&
      message.structuredResponse?.experience?.choices.some(
        (choice) =>
          choice.confirmation?.kind === "beta-session-decision" &&
          choice.confirmation.decision === workflow.sessionDecision?.kind,
      ))
      ? { betaSessionDecisionConfirmed: true }
      : {}),
  })) ?? [];
}
