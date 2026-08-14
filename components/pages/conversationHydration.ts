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
  const closedReviewTargetId = conversation?.betaWorkflow?.status === "closed"
    ? conversation.messages.findLast((message) => message.role === "assistant")?.messageId
    : undefined;

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
    conversation.betaWorkflow?.sessionEvaluation?.sourceMessageId === message.messageId
      ? {
          betaSessionEvaluation: {
            outcomeSatisfied: conversation.betaWorkflow.sessionEvaluation.outcomeSatisfied,
            summary: conversation.betaWorkflow.sessionEvaluation.summary,
          },
          betaSessionEvaluationConfirmed: true,
        }
      : {}),
    ...(message.role === "assistant" &&
    closedReviewTargetId === message.messageId &&
    conversation.betaWorkflow?.sessionEvaluation
      ? {
          betaSessionEvaluation: {
            outcomeSatisfied: conversation.betaWorkflow.sessionEvaluation.outcomeSatisfied,
            summary: conversation.betaWorkflow.sessionEvaluation.summary,
          },
          betaSessionEvaluationConfirmed: true,
          betaSessionClosed: true,
        }
      : {}),
    ...(message.role === "assistant" &&
    conversation.betaWorkflow?.verifiedExecutions?.some(
      (evidence) => evidence.sourceMessageId === message.messageId,
    )
      ? { betaExecutionVerified: true }
      : {}),
    ...(message.role === "assistant" &&
    conversation.betaWorkflow?.confirmedNextStep?.sourceMessageId === message.messageId
      ? { betaNextStepConfirmed: true }
      : {}),
    ...(message.role === "assistant" &&
    conversation.betaWorkflow?.confirmedNextStep?.sourceMessageId === message.messageId &&
    conversation.betaWorkflow.sessionDecision
      ? { betaSessionDecision: conversation.betaWorkflow.sessionDecision.kind }
      : {}),
  })) ?? [];
}
