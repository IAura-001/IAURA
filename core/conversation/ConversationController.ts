import {
  iauraBrain,
  type BrainInput,
  type CognitiveRequest,
} from "../brain";
import {
  projectRepository,
  type ProjectRepository,
} from "../project/ProjectRepository";
import {
  assistantMessageMetadata,
  conversationRepository,
  type Conversation,
  type ConversationMessage,
  type ConversationRepository,
} from "./ConversationRepository";

import type { AuraAssistantPlan } from "@/core/actions";
import {
  generateCognitiveResponse,
} from "@/services/cognitive";

export type ConversationTurnErrorCode =
  | "IAURA_CONVERSATION_PERSISTENCE_FAILED"
  | "IAURA_CONVERSATION_PROVIDER_FAILED";

export class ConversationTurnError extends Error {
  readonly recoverable = true;

  constructor(
    readonly code: ConversationTurnErrorCode,
    readonly stage:
      | "conversation"
      | "user_message"
      | "generation"
      | "assistant_message",
    readonly conversationId?: string,
    readonly userMessageId?: string,
  ) {
    super(
      code === "IAURA_CONVERSATION_PROVIDER_FAILED"
        ? "IAURA could not generate a response. Your message was preserved for retry."
        : "IAURA could not safely persist the conversation.",
    );
    this.name = "ConversationTurnError";
  }
}

interface BrainAnalyzer {
  analyze(input: BrainInput): CognitiveRequest;
}

type ResponseGenerator = (
  request: CognitiveRequest,
) => Promise<AuraAssistantPlan>;

interface ConversationControllerOptions {
  conversations?: ConversationRepository;
  projects?: ProjectRepository;
  brain?: BrainAnalyzer;
  generateResponse?: ResponseGenerator;
}

function toBrainHistory(messages: ConversationMessage[]) {
  return messages.map(({ role, content }) => ({ role, content }));
}

export class ConversationController {
  private readonly conversations: ConversationRepository;
  private readonly projects: ProjectRepository;
  private readonly brain: BrainAnalyzer;
  private readonly generateResponse: ResponseGenerator;

  constructor(options: ConversationControllerOptions = {}) {
    this.conversations = options.conversations ?? conversationRepository;
    this.projects = options.projects ?? projectRepository;
    this.brain = options.brain ?? iauraBrain;
    this.generateResponse =
  options.generateResponse ??
  generateCognitiveResponse;
  }

  private resolveConversation(): Conversation {
    const activeProject = this.projects.getActiveProject();
    const projectId = activeProject?.id ?? null;
    const existing = this.conversations.getActiveConversation(projectId);

    if (existing) {
      const activation = this.conversations.setActiveConversation(
        existing.conversationId,
      );
      if (!activation.ok) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PERSISTENCE_FAILED",
          "conversation",
          existing.conversationId,
        );
      }
      return existing;
    }

    const created = this.conversations.createConversation({
      ...(activeProject ? { projectId: activeProject.id } : {}),
      title: activeProject?.name ?? "General conversation",
    });
    if (!created.ok || !created.conversation) {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        "conversation",
      );
    }
    return created.conversation;
  }

  private persistUserMessage(
    conversation: Conversation,
    message: string,
  ): ConversationMessage {
    const lastMessage = conversation.messages.at(-1);
    if (
      lastMessage?.role === "user" &&
      lastMessage.content.trim() === message.trim()
    ) {
      return lastMessage;
    }

    const write = this.conversations.appendMessage(
      conversation.conversationId,
      { role: "user", content: message },
    );
    if (!write.ok || !write.message) {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        "user_message",
        conversation.conversationId,
      );
    }
    return write.message;
  }

  async send(
    message: string,
    userContext: string,
  ): Promise<AuraAssistantPlan> {
    const conversation = this.resolveConversation();
    const userMessage = this.persistUserMessage(conversation, message);
    const history = toBrainHistory(
      this.conversations.getWorkingHistory(conversation.conversationId, {
        excludeMessageId: userMessage.messageId,
      }),
    );
    const result = this.brain.analyze({
      message,
      userContext,
      history,
      conversationIdentity: {
        conversationId: conversation.conversationId,
        ...(conversation.projectId ? { projectId: conversation.projectId } : {}),
      },
    });

    let response: AuraAssistantPlan;

try {
  response = await this.generateResponse(result);
} catch {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PROVIDER_FAILED",
        "generation",
        conversation.conversationId,
        userMessage.messageId,
      );
    }

    const assistantWrite = this.conversations.appendMessage(
      conversation.conversationId,
      {
        role: "assistant",
        content: response.content,
        structuredResponse: assistantMessageMetadata(response),
      },
    );
    if (!assistantWrite.ok) {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        "assistant_message",
        conversation.conversationId,
        userMessage.messageId,
      );
    }

    return response;
  }
}

export const conversationController = new ConversationController();
