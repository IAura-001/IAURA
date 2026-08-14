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
  | "IAURA_CONTEXT_RETRIEVAL_FAILED"
  | "IAURA_BETA_CONFIRMATION_INVALID"
  | "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE";

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

export interface ConversationTurnResult {
  plan: AuraAssistantPlan;
  assistantMessageId: string;
}

interface ConversationControllerOptions {
  conversations?: ConversationRepository;
  projects?: ProjectRepository;
  brain?: BrainAnalyzer;
  generateResponse?: ResponseGenerator;
  contextRetriever?: ContextRetrievalService;
  now?: () => string;
}

function serializeBetaWorkflow(conversation: Conversation): string {
  const workflow = conversation.betaWorkflow;
  if (!workflow) return "";

  return [
    "BETA 01 CONVERSATION WORKFLOW — PROJECT-SCOPED",
    `Status: ${workflow.status}`,
    workflow.confirmedContext
      ? `Confirmed context:\n- Goal: ${workflow.confirmedContext.goal}\n- Blocker: ${workflow.confirmedContext.blocker}\n- Summary: ${workflow.confirmedContext.summary}`
      : "Confirmed context: none",
    workflow.confirmedOutcome
      ? `Confirmed outcome:\n- Outcome: ${workflow.confirmedOutcome.outcome}\n- Done when: ${workflow.confirmedOutcome.doneWhen}`
      : "Confirmed outcome: none",
    workflow.confirmedNextStep
      ? `Confirmed next step:\n- Action: ${workflow.confirmedNextStep.action}\n- Why now: ${workflow.confirmedNextStep.whyNow}\n- Result: ${workflow.confirmedNextStep.result}\n- Done when: ${workflow.confirmedNextStep.doneWhen}`
      : "Confirmed next step: none",
    workflow.sessionDecision?.kind === "start-now"
      ? "Session decision: Founder chose to start the confirmed next step now.\nExecution status: Decision recorded; completion has not been verified."
      : workflow.sessionDecision?.kind === "continue-later"
        ? "Session decision: Founder chose to continue this step later.\nExecution status: Not started."
        : "Session decision: none",
  ].join("\n");
}

function sameChoice(
  left: AuraExperienceChoice,
  right: AuraExperienceChoice,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameNextStep(
  recommendation: NonNullable<ConversationMessage["structuredResponse"]>["betaNextStep"],
  confirmation: Extract<AuraExperienceChoice["confirmation"], { kind: "beta-next-step" }>,
): boolean {
  return Boolean(
    recommendation &&
    recommendation.action === confirmation.action &&
    recommendation.whyNow === confirmation.whyNow &&
    recommendation.result === confirmation.result &&
    recommendation.doneWhen === confirmation.doneWhen,
  );
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
  private readonly now: () => string;

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
    this.now = options.now ?? (() => new Date().toISOString());
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
  ): Promise<ConversationTurnResult> {
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
        mergeUserContext(userContext, serializeBetaWorkflow(conversation)),
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

    if (!assistantWrite.ok || !assistantWrite.message) {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        "assistant_message",
        conversation.conversationId,
        userMessage.messageId,
      );
    }

    return {
      plan: response,
      assistantMessageId: assistantWrite.message.messageId,
    };
  }

  async send(
    message: string,
    userContext: string,
  ): Promise<ConversationTurnResult> {
    const conversation = this.resolveConversation();
    return this.sendInConversation(
      conversation,
      message,
      userContext,
    );
  }

  async sendChoice(
    choice: AuraExperienceChoice,
    sourceMessageId: string,
    userContext: string,
  ): Promise<ConversationTurnResult> {
    const conversation = this.resolveConversation();
    const sourceMessage = conversation.messages.find(
      (message) => message.messageId === sourceMessageId && message.role === "assistant",
    );
    const persistedChoice = sourceMessage?.structuredResponse?.experience?.choices.find(
      (candidate) => sameChoice(candidate, choice),
    );

    if (!sourceMessage || !persistedChoice) {
      throw new ConversationTurnError(
        "IAURA_BETA_CONFIRMATION_INVALID",
        "conversation",
        conversation.conversationId,
      );
    }

    const confirmation = persistedChoice.confirmation;

    if (
      confirmation?.kind === "project-decision" &&
      conversation.projectId
    ) {
      const confirmedDecision: PlannedMemoryUpdate = {
        operation: "remember",
        type: "project",
        content: confirmation.content,
        tags: [],
        reason: "The user explicitly selected this project decision.",
        confidence: 1,
      };

      executeMemoryUpdates([confirmedDecision], conversation.projectId);
    }

    if (confirmation?.kind === "beta-context") {
      const existing = conversation.betaWorkflow?.confirmedContext;
      const alreadyConfirmed =
        existing?.sourceMessageId === sourceMessage.messageId &&
        existing.goal === confirmation.goal &&
        existing.blocker === confirmation.blocker &&
        existing.summary === confirmation.summary &&
        conversation.betaWorkflow?.status === "defining-outcome";
      const write = alreadyConfirmed
        ? { ok: true, outcome: "unchanged" as const }
        : this.conversations.updateConversationMetadata(
        conversation.conversationId,
        {
          betaWorkflow: {
            version: 1,
            status: "defining-outcome",
            confirmedContext: {
              goal: confirmation.goal,
              blocker: confirmation.blocker,
              summary: confirmation.summary,
              sourceMessageId: sourceMessage.messageId,
              confirmedAt: this.now(),
            },
            ...(conversation.betaWorkflow?.confirmedOutcome
              ? { confirmedOutcome: conversation.betaWorkflow.confirmedOutcome }
              : {}),
          },
        },
      );
      if (!write.ok) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PERSISTENCE_FAILED",
          "conversation",
          conversation.conversationId,
        );
      }
    }

    if (confirmation?.kind === "beta-outcome") {
      if (!conversation.betaWorkflow?.confirmedContext) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE",
          "conversation",
          conversation.conversationId,
        );
      }
      const existing = conversation.betaWorkflow.confirmedOutcome;
      const alreadyConfirmed =
        existing?.sourceMessageId === sourceMessage.messageId &&
        existing.outcome === confirmation.outcome &&
        existing.doneWhen === confirmation.doneWhen &&
        conversation.betaWorkflow.status === "recommended";
      const write = alreadyConfirmed
        ? { ok: true, outcome: "unchanged" as const }
        : this.conversations.updateConversationMetadata(
        conversation.conversationId,
        {
          betaWorkflow: {
            ...conversation.betaWorkflow,
            version: 1,
            status: "recommended",
            confirmedOutcome: {
              outcome: confirmation.outcome,
              doneWhen: confirmation.doneWhen,
              sourceMessageId: sourceMessage.messageId,
              confirmedAt: this.now(),
            },
          },
        },
      );
      if (!write.ok) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PERSISTENCE_FAILED",
          "conversation",
          conversation.conversationId,
        );
      }
    }

    if (confirmation?.kind === "beta-next-step") {
      if (
        !conversation.betaWorkflow?.confirmedContext ||
        !conversation.betaWorkflow.confirmedOutcome ||
        !sameNextStep(sourceMessage.structuredResponse?.betaNextStep, confirmation)
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_INVALID",
          "conversation",
          conversation.conversationId,
        );
      }

      const existing = conversation.betaWorkflow.confirmedNextStep;
      const alreadyConfirmed =
        existing?.sourceMessageId === sourceMessage.messageId &&
        existing.action === confirmation.action &&
        existing.whyNow === confirmation.whyNow &&
        existing.result === confirmation.result &&
        existing.doneWhen === confirmation.doneWhen &&
        conversation.betaWorkflow.status === "ready-to-start";
      const write = alreadyConfirmed
        ? { ok: true, outcome: "unchanged" as const }
        : this.conversations.updateConversationMetadata(
          conversation.conversationId,
          {
            betaWorkflow: {
              ...conversation.betaWorkflow,
              version: 1,
              status: "ready-to-start",
              confirmedNextStep: {
                action: confirmation.action,
                whyNow: confirmation.whyNow,
                result: confirmation.result,
                doneWhen: confirmation.doneWhen,
                sourceMessageId: sourceMessage.messageId,
                confirmedAt: this.now(),
              },
            },
          },
        );
      if (!write.ok) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PERSISTENCE_FAILED",
          "conversation",
          conversation.conversationId,
        );
      }
    }

    if (confirmation?.kind === "beta-session-decision") {
      const workflow = conversation.betaWorkflow;
      if (
        !workflow?.confirmedContext ||
        !workflow.confirmedOutcome ||
        !workflow.confirmedNextStep ||
        workflow.status !== "ready-to-start"
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE",
          "conversation",
          conversation.conversationId,
        );
      }

      const write = this.conversations.updateConversationMetadata(
        conversation.conversationId,
        {
          betaWorkflow: {
            ...workflow,
            version: 1,
            status: confirmation.decision === "start-now" ? "started" : "deferred",
            sessionDecision: {
              kind: confirmation.decision,
              sourceMessageId: sourceMessage.messageId,
              decidedAt: this.now(),
            },
          },
        },
      );
      if (!write.ok) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PERSISTENCE_FAILED",
          "conversation",
          conversation.conversationId,
        );
      }
    }

    return this.sendInConversation(
      this.conversations.getConversation(conversation.conversationId) ?? conversation,
      persistedChoice.prompt,
      userContext,
    );
  }
}

export const conversationController =
  new ConversationController();
