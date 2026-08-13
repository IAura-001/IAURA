import type {
  AuraAssistantPlan,
  AuraExperienceChoice,
  PlannedMemoryUpdate,
} from "@/core/actions";
import { executeMemoryUpdates } from "@/core/memory";
import { generateCognitiveResponse } from "@/services/cognitive";

import {
  iauraBrain,
  type BrainInput,
  type CognitiveRequest,
} from "../brain";
import {
  ContextRetriever,
  LocalConversationContextSource,
  LocalMemoryContextSource,
  mergeUserContext,
  serializeContextPackage,
  type ContextPackage,
  type ContextRetrievalRequest,
} from "../context";
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

export type ConversationTurnErrorCode =
  | "IAURA_CONVERSATION_PERSISTENCE_FAILED"
  | "IAURA_CONVERSATION_PROVIDER_FAILED"
  | "IAURA_CONTEXT_RETRIEVAL_FAILED";

export type ConversationTurnStage =
  | "conversation"
  | "user_message"
  | "context"
  | "generation"
  | "assistant_message";

export class ConversationTurnError extends Error {
  readonly recoverable = true;

  constructor(
    readonly code: ConversationTurnErrorCode,
    readonly stage: ConversationTurnStage,
    readonly conversationId?: string,
    readonly userMessageId?: string,
  ) {
    super(
      code === "IAURA_CONVERSATION_PROVIDER_FAILED"
        ? "IAURA could not generate a response. Your message was preserved for retry."
        : code === "IAURA_CONTEXT_RETRIEVAL_FAILED"
          ? "IAURA could not retrieve the context required for this response. Your message was preserved for retry."
          : "IAURA could not safely persist the conversation.",
    );

    this.name = "ConversationTurnError";
  }
}

interface BrainAnalyzer {
  analyze(input: BrainInput): CognitiveRequest;
}

interface ContextRetrievalService {
  retrieve(
    request: ContextRetrievalRequest,
  ): Promise<ContextPackage>;
}

type ResponseGenerator = (
  request: CognitiveRequest,
) => Promise<AuraAssistantPlan>;

interface ConversationControllerOptions {
  conversations?: ConversationRepository;
  projects?: ProjectRepository;
  brain?: BrainAnalyzer;
  generateResponse?: ResponseGenerator;
  contextRetriever?: ContextRetrievalService;
}

function toBrainHistory(
  messages: ConversationMessage[],
): BrainInput["history"] {
  return messages.map(({ role, content }) => ({
    role,
    content,
  }));
}

export class ConversationController {
  private readonly conversations: ConversationRepository;
  private readonly projects: ProjectRepository;
  private readonly brain: BrainAnalyzer;
  private readonly generateResponse: ResponseGenerator;
  private readonly contextRetriever: ContextRetrievalService;

  constructor(options: ConversationControllerOptions = {}) {
    this.conversations =
      options.conversations ?? conversationRepository;

    this.projects =
      options.projects ?? projectRepository;

    this.brain =
      options.brain ?? iauraBrain;

    this.generateResponse =
      options.generateResponse ?? generateCognitiveResponse;

    this.contextRetriever =
      options.contextRetriever ??
      new ContextRetriever({
        conversationSource:
          new LocalConversationContextSource(
            this.conversations,
          ),
        memorySource:
          new LocalMemoryContextSource(),
      });
  }

  private resolveConversation(): Conversation {
    const activeProject = this.projects.getActiveProject();
    const projectId = activeProject?.id ?? null;

    const existing =
      this.conversations.getActiveConversation(projectId);

    if (existing) {
      const activation =
        this.conversations.setActiveConversation(
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

    const created =
      this.conversations.createConversation({
        ...(activeProject
          ? { projectId: activeProject.id }
          : {}),
        title:
          activeProject?.name ??
          "General conversation",
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
    const lastMessage =
      conversation.messages.at(-1);

    if (
      lastMessage?.role === "user" &&
      lastMessage.content.trim() === message.trim()
    ) {
      return lastMessage;
    }

    const write =
      this.conversations.appendMessage(
        conversation.conversationId,
        {
          role: "user",
          content: message,
        },
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

  private async retrieveContext(
    conversation: Conversation,
    userMessage: ConversationMessage,
    message: string,
  ): Promise<ContextPackage> {
    try {
      return await this.contextRetriever.retrieve({
        userId: "local-user",
         conversationId:
           conversation.conversationId,
         projectId: conversation.projectId,
         message,
      });
    } catch {
      throw new ConversationTurnError(
        "IAURA_CONTEXT_RETRIEVAL_FAILED",
        "context",
        conversation.conversationId,
        userMessage.messageId,
      );
    }
  }

  private async sendInConversation(
    conversation: Conversation,
    message: string,
    userContext: string,
  ): Promise<AuraAssistantPlan> {
    const userMessage =
      this.persistUserMessage(
        conversation,
        message,
      );

    const history = toBrainHistory(
      this.conversations.getWorkingHistory(
        conversation.conversationId,
        {
          excludeMessageId:
            userMessage.messageId,
        },
      ),
    );

    const contextPackage =
      await this.retrieveContext(
        conversation,
        userMessage,
        message,
      );

    const retrievedContext =
      serializeContextPackage(contextPackage);

    const enrichedUserContext =
      mergeUserContext(
        userContext,
        retrievedContext,
      );

    const result =
      this.brain.analyze({
        message,
        userContext: enrichedUserContext,
        history,
        conversationIdentity: {
          conversationId:
            conversation.conversationId,
          ...(conversation.projectId
            ? {
                projectId:
                  conversation.projectId,
              }
            : {}),
        },
      });

    let response: AuraAssistantPlan;

    try {
      response =
        await this.generateResponse(result);
    } catch {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PROVIDER_FAILED",
        "generation",
        conversation.conversationId,
        userMessage.messageId,
      );
    }

    executeMemoryUpdates(
      response.memoryUpdates,
      conversation.projectId,
    );

    const assistantWrite =
      this.conversations.appendMessage(
        conversation.conversationId,
        {
          role: "assistant",
          content: response.content,
          structuredResponse:
            assistantMessageMetadata(response),
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

  async send(
    message: string,
    userContext: string,
  ): Promise<AuraAssistantPlan> {
    return this.sendInConversation(
      this.resolveConversation(),
      message,
      userContext,
    );
  }

  async sendChoice(
    choice: AuraExperienceChoice,
    userContext: string,
  ): Promise<AuraAssistantPlan> {
    const conversation = this.resolveConversation();

    if (
      choice.confirmation?.kind === "project-decision" &&
      conversation.projectId
    ) {
      const confirmedDecision: PlannedMemoryUpdate = {
        operation: "remember",
        type: "project",
        content: choice.confirmation.content,
        tags: [],
        reason: "The user explicitly selected this project decision.",
        confidence: 1,
      };

      executeMemoryUpdates([confirmedDecision], conversation.projectId);
    }

    return this.sendInConversation(
      conversation,
      choice.prompt,
      userContext,
    );
  }
}

export const conversationController =
  new ConversationController();
