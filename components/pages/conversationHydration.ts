import type { ChatMessage } from "@/types/chat";
import type { ConversationRepository } from "@/core/conversation";

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

  return conversation?.messages.map((message) => ({
    id: message.messageId,
    role: message.role,
    content: message.content,
    ...(message.role === "assistant" &&
    message.structuredResponse?.experience
      ? { experience: message.structuredResponse.experience }
      : {}),
    ...(message.role === "assistant" &&
    message.structuredResponse?.betaNextStep
      ? { betaNextStep: message.structuredResponse.betaNextStep }
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
