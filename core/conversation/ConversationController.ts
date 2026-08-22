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
import { authenticatedProjectRepository } from "../project/AuthenticatedProjectRepository";
import type { IAuraProject } from "@/types/project";
import {
  authenticatedIntelligenceRepository,
  emptyIntelligenceContextProjection,
  type IntelligenceContextProjection,
  intelligenceActionExecutor,
  type IntelligenceActionProposal,
  type IntelligenceActionReceipt,
} from "../intelligence";
import { serializeIntelligenceContext } from "../prompt/PromptBuilder";
import {
  assistantMessageMetadata,
  conversationRepository,
  type Conversation,
  type ConversationMessage,
  type ConversationRepository,
  type BetaWorkflowMetadata,
} from "./ConversationRepository";
import { authenticatedConversationRepository, AuthenticatedConversationPersistenceError } from "./AuthenticatedConversationRepository";
import { deferredContinuityProvenance } from "./BetaContinuity";

export type ConversationTurnErrorCode =
  | "IAURA_CONVERSATION_PERSISTENCE_FAILED"
  | "IAURA_CONVERSATION_PROVIDER_FAILED"
  | "IAURA_CONTEXT_RETRIEVAL_FAILED"
  | "IAURA_CONVERSATION_STALE_CONFIRMATION"
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
      code === "IAURA_CONVERSATION_STALE_CONFIRMATION"
        ? "This proposal is stale because the conversation changed in another session. Refresh and ask Aura to regenerate it."
        : code === "IAURA_CONVERSATION_PROVIDER_FAILED"
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

interface IntelligenceContextSource {
  loadContextProjection(
    activeProject: IAuraProject | null,
  ): Promise<IntelligenceContextProjection>;
}

interface IntelligenceMutationExecutor {
  execute(proposal: IntelligenceActionProposal, sourceMessageId: string, activeProject: IAuraProject | null): Promise<IntelligenceActionReceipt>;
}

type ResponseGenerator = (
  request: CognitiveRequest,
) => Promise<AuraAssistantPlan>;

export interface ConversationTurnResult {
  plan: AuraAssistantPlan;
  assistantMessageId: string;
}

export interface DeferredContinuityResumeRequest {
  projectId: string;
  conversationId: string;
  expectedRevision: number;
  stepSourceMessageId: string;
  deferSourceMessageId: string;
}

interface ConversationControllerOptions {
  conversations?: ConversationRepository;
  projects?: ProjectRepository;
  brain?: BrainAnalyzer;
  generateResponse?: ResponseGenerator;
  contextRetriever?: ContextRetrievalService;
  intelligenceContextSource?: IntelligenceContextSource | null;
  authenticatedUserId?: () => string | null;
  intelligenceActionExecutor?: IntelligenceMutationExecutor;
  now?: () => string;
  evidenceIdFactory?: () => string;
}

function serializeBetaWorkflow(conversation: Conversation): string {
  const workflow = conversation.betaWorkflow;
  if (!workflow) {
    const latestCompleted = conversation.completedBetaWorkflows?.at(-1);
    return latestCompleted?.postClosureHandoff?.decision === "begin-another-cycle"
      ? [
          "BETA 01 CONVERSATION WORKFLOW — PROJECT-SCOPED",
          "Active workflow: none. A fresh Beta cycle may begin only through new context confirmation.",
          "Latest completed workflow: closed and archived as immutable history.",
          "Post-closure handoff: Founder explicitly chose to begin another cycle. The handoff is complete and is not pending.",
          "Historical context, outcomes, steps, evidence, review and closure are not active workflow state.",
        ].join("\n")
      : "";
  }

  const verifiedEvidence = workflow.verifiedExecutions ?? [];
  const latestEvidence = verifiedEvidence.at(-1);
  const latestRecovery = latestEvidence
    ? workflow.incompleteExecutionRecoveries?.find(
        (recovery) => recovery.evidenceId === latestEvidence.evidenceId,
      )
    : undefined;

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
    latestEvidence
      ? `Verified execution evidence (${verifiedEvidence.length} record${verifiedEvidence.length === 1 ? "" : "s"}):\n- Result: ${latestEvidence.result}\n- Observation: ${latestEvidence.observation}\n- Done-when satisfied: ${latestEvidence.doneWhenSatisfied ? "yes" : "no"}\n- Verification recorded.`
      : "Verified execution evidence: none",
    latestRecovery?.decision === "retry-now"
      ? "Incomplete-execution recovery: Founder chose to retry the same confirmed step now. Previous evidence remains preserved; a new founder report is required."
      : latestRecovery?.decision === "retry-later"
        ? "Incomplete-execution recovery: Founder chose to continue the same confirmed step later. Previous evidence remains preserved."
        : latestEvidence && (latestEvidence.result !== "passed" || !latestEvidence.doneWhenSatisfied)
          ? "Incomplete-execution recovery: pending explicit founder choice between retrying now and continuing later."
          : "Incomplete-execution recovery: not applicable.",
    workflow.status === "evaluated"
      ? "Confirmed-step verification: Done-when criterion satisfied by founder-confirmed evidence. The Beta session is not closed."
      : "Confirmed-step verification: not established.",
    workflow.sessionEvaluation
      ? `Confirmed session evaluation:\n- Outcome satisfied: ${workflow.sessionEvaluation.outcomeSatisfied ? "yes" : "no"}\n- Summary: ${workflow.sessionEvaluation.summary}\n- The session remains open until an explicit trusted close choice.`
      : "Confirmed session evaluation: none",
    workflow.sessionClosure
      ? `Session closure: explicitly closed at ${workflow.sessionClosure.closedAt}.`
      : "Session closure: none",
    workflow.postClosureHandoff?.decision === "finish-here"
      ? "Post-closure handoff: Founder explicitly chose to finish here. The handoff is complete; do not request or offer another handoff."
      : workflow.postClosureHandoff?.decision === "begin-another-cycle"
        ? "Post-closure handoff: Founder explicitly chose to begin another cycle. The handoff is complete and is not pending."
        : workflow.status === "closed"
          ? "Post-closure handoff: pending explicit founder choice."
          : "Post-closure handoff: not applicable.",
  ].join("\n");
}

function sameChoice(
  left: AuraExperienceChoice,
  right: AuraExperienceChoice,
): boolean {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
    return value;
  };
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
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

function sameExecutionEvaluation(
  evaluation: NonNullable<ConversationMessage["structuredResponse"]>["betaExecutionEvaluation"],
  confirmation: Extract<
    AuraExperienceChoice["confirmation"],
    { kind: "beta-execution-evaluation" }
  >,
): boolean {
  return Boolean(
    evaluation &&
    evaluation.result === confirmation.result &&
    evaluation.observation === confirmation.observation &&
    evaluation.doneWhenSatisfied === confirmation.doneWhenSatisfied,
  );
}

function sameSessionEvaluation(
  evaluation: NonNullable<ConversationMessage["structuredResponse"]>["betaSessionEvaluation"],
  confirmation: Extract<
    AuraExperienceChoice["confirmation"],
    { kind: "beta-session-evaluation" }
  >,
): boolean {
  return Boolean(
    evaluation &&
    evaluation.outcomeSatisfied === confirmation.outcomeSatisfied &&
    evaluation.summary === confirmation.summary,
  );
}

function isBetaConfirmation(
  confirmation: AuraExperienceChoice["confirmation"],
): boolean {
  return Boolean(confirmation?.kind.startsWith("beta-"));
}

function incompleteExecutionRecoveryChoices(): AuraExperienceChoice[] {
  return [
    {
      label: "Reintentar ahora",
      description: "Mantiene el mismo paso activo y espera un nuevo reporte de ejecución.",
      prompt: "Reintentar ahora el mismo paso confirmado.",
      confirmation: {
        kind: "beta-incomplete-execution-recovery",
        decision: "retry-now",
      },
    },
    {
      label: "Continuar después",
      description: "Conserva el paso y toda la evidencia para retomarlo más adelante.",
      prompt: "Continuar después con el mismo paso confirmado.",
      confirmation: {
        kind: "beta-incomplete-execution-recovery",
        decision: "retry-later",
      },
    },
  ];
}

function readyToStartChoices(): AuraExperienceChoice[] {
  return [
    {
      label: "Empezar ahora",
      description: "Inicia el paso confirmado sin afirmar que ya fue ejecutado.",
      prompt: "Empezar ahora la ejecución del paso confirmado.",
      confirmation: {
        kind: "beta-session-decision",
        decision: "start-now",
      },
    },
    {
      label: "Continuar después",
      description: "Conserva el mismo paso confirmado para retomarlo más adelante.",
      prompt: "Continuar después con el mismo paso confirmado.",
      confirmation: {
        kind: "beta-session-decision",
        decision: "continue-later",
      },
    },
  ];
}

function latestIncompleteEvidenceIsReadyForReport(
  workflow: BetaWorkflowMetadata,
): boolean {
  const latestEvidence = workflow.verifiedExecutions?.at(-1);
  if (!latestEvidence || (latestEvidence.result === "passed" && latestEvidence.doneWhenSatisfied)) {
    return true;
  }
  const recovery = workflow.incompleteExecutionRecoveries?.find(
    (candidate) => candidate.evidenceId === latestEvidence.evidenceId,
  );
  return recovery?.decision === "retry-now" ||
    (recovery?.decision === "retry-later" &&
      workflow.sessionDecision?.kind === "start-now" &&
      Date.parse(workflow.sessionDecision.decidedAt) > Date.parse(recovery.confirmedAt));
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
  private readonly intelligenceContextSource: IntelligenceContextSource | null;
  private readonly authenticatedUserId: () => string | null;
  private readonly intelligenceMutationExecutor: IntelligenceMutationExecutor;
  private readonly pendingIntelligenceConfirmations = new Map<string, Promise<ConversationTurnResult>>();
  private readonly now: () => string;
  private readonly evidenceIdFactory: () => string;

  private async flushConversationPersistence(
    stage: ConversationTurnStage,
    conversationId: string,
    userMessageId?: string,
  ): Promise<void> {
    if (!("flush" in this.conversations) || typeof this.conversations.flush !== "function") {
      return;
    }
    try {
      await this.conversations.flush();
    } catch (error) {
      if (error instanceof AuthenticatedConversationPersistenceError) throw error;
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        stage,
        conversationId,
        userMessageId,
      );
    }
  }

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
    this.intelligenceContextSource = options.intelligenceContextSource ??
      (process.env.NODE_ENV === "test" ? null : authenticatedIntelligenceRepository);
    this.authenticatedUserId = options.authenticatedUserId ?? (() =>
      "getAuthenticatedUserId" in this.conversations &&
      typeof this.conversations.getAuthenticatedUserId === "function"
        ? this.conversations.getAuthenticatedUserId() as string | null
        : null);
    this.intelligenceMutationExecutor = options.intelligenceActionExecutor ?? intelligenceActionExecutor;
    this.now = options.now ?? (() => new Date().toISOString());
    this.evidenceIdFactory = options.evidenceIdFactory ??
      (() => `evidence-${crypto.randomUUID()}`);
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

  private async persistUserMessage(
    conversation: Conversation,
    message: string,
  ): Promise<ConversationMessage> {
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

    await this.flushConversationPersistence(
      "user_message",
      conversation.conversationId,
      write.message.messageId,
    );

    return write.message;
  }

  private async retrieveContext(
    conversation: Conversation,
    userMessage: ConversationMessage,
    message: string,
  ): Promise<ContextPackage> {
    try {
      return await this.contextRetriever.retrieve({
        userId: this.authenticatedUserId() ?? "local-user",
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

  private async loadIntelligenceContext(
    activeProject: IAuraProject | null,
  ): Promise<IntelligenceContextProjection> {
    if (!this.intelligenceContextSource) {
      return emptyIntelligenceContextProjection(activeProject);
    }
    try {
      return await this.intelligenceContextSource.loadContextProjection(activeProject);
    } catch (error) {
      console.warn(
        "IAURA Intelligence context retrieval failed; continuing without canonical Intelligence.",
        error instanceof Error ? error.message.slice(0, 300) : "Unknown Intelligence retrieval failure.",
      );
      return emptyIntelligenceContextProjection(activeProject);
    }
  }

  private async sendInConversation(
    conversation: Conversation,
    message: string,
    userContext: string,
    options: {
      allowBetaExecutionEvaluation?: boolean;
      allowBetaSessionEvaluation?: boolean;
    } = {},
  ): Promise<ConversationTurnResult> {
    const userMessage =
      await this.persistUserMessage(
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

    const activeProject = this.projects.getActiveProject();
    const intelligenceContext = await this.loadIntelligenceContext(
      activeProject?.id === conversation.projectId ? activeProject : null,
    );
    const serializedIntelligence = serializeIntelligenceContext(intelligenceContext);

    const retrievedContext =
      serializeContextPackage(contextPackage);

    const enrichedUserContext =
      mergeUserContext(
        mergeUserContext(
          mergeUserContext(userContext, serializedIntelligence),
          serializeBetaWorkflow(conversation),
        ),
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

    let generatedResponse: AuraAssistantPlan;

    try {
      generatedResponse =
        await this.generateResponse(result);
    } catch {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PROVIDER_FAILED",
        "generation",
        conversation.conversationId,
        userMessage.messageId,
      );
    }

    const intelligenceChoices = generatedResponse.experience.choices.filter(
      (choice) => choice.confirmation?.kind === "intelligence-action",
    );
    const hasIntelligenceProposal = intelligenceChoices.length > 0;
    if (hasIntelligenceProposal) {
      const confirmations = intelligenceChoices.map((choice) =>
        choice.confirmation?.kind === "intelligence-action" ? choice.confirmation : null);
      const decisions = new Set(confirmations.map((confirmation) => confirmation?.decision));
      const proposals = confirmations.map((confirmation) => JSON.stringify(confirmation?.proposal));
      if (confirmations.length !== 2 || !decisions.has("confirm") || !decisions.has("cancel") || proposals[0] !== proposals[1]) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PROVIDER_FAILED", "generation", conversation.conversationId, userMessage.messageId,
        );
      }
      const proposal = confirmations[0]!.proposal;
      if (proposal.scopeType === "project" &&
        (proposal.projectId !== conversation.projectId ||
          proposal.expectedActiveProjectId !== conversation.projectId ||
          activeProject?.id !== conversation.projectId)) {
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_PROVIDER_FAILED", "generation", conversation.conversationId, userMessage.messageId,
        );
      }
    }
    if (hasIntelligenceProposal && generatedResponse.actions.some((action) =>
      ["add_goal", "remove_goal", "add_habit", "remove_habit"].includes(action.type))) {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PROVIDER_FAILED",
        "generation",
        conversation.conversationId,
        userMessage.messageId,
      );
    }
    if (hasIntelligenceProposal) {
      const executionId = crypto.randomUUID();
      generatedResponse = {
        ...generatedResponse,
        experience: {
          ...generatedResponse.experience,
          choices: generatedResponse.experience.choices.map((choice) =>
            choice.confirmation?.kind === "intelligence-action"
              ? { ...choice, confirmation: { ...choice.confirmation, proposal: { ...choice.confirmation.proposal, executionId } } }
              : choice),
        },
      };
    }

    const evaluationAllowed =
      options.allowBetaExecutionEvaluation !== false &&
      conversation.betaWorkflow?.status === "started" &&
      Boolean(conversation.betaWorkflow.confirmedNextStep) &&
      latestIncompleteEvidenceIsReadyForReport(conversation.betaWorkflow);
    const sessionEvaluationAllowed =
      options.allowBetaSessionEvaluation !== false &&
      conversation.betaWorkflow?.status === "evaluated" &&
      Boolean(conversation.betaWorkflow.confirmedOutcome?.doneWhen) &&
      Boolean(conversation.betaWorkflow.confirmedNextStep) &&
      Boolean(conversation.betaWorkflow.verifiedExecutions?.some(
        (evidence) => evidence.result === "passed" && evidence.doneWhenSatisfied,
      )) &&
      !conversation.betaWorkflow.sessionEvaluation;
    const nextStepAllowed = conversation.betaWorkflow?.status === "recommended";
    const sessionDecisionAllowed = conversation.betaWorkflow?.status === "ready-to-start";
    const closureChoiceAllowed =
      conversation.betaWorkflow?.status === "evaluated" &&
      conversation.betaWorkflow.sessionEvaluation?.outcomeSatisfied === true &&
      !conversation.betaWorkflow.sessionClosure;
    const handoffChoiceAllowed =
      conversation.betaWorkflow?.status === "closed" &&
      Boolean(conversation.betaWorkflow.sessionClosure) &&
      !conversation.betaWorkflow.postClosureHandoff;
    const latestEvidence = conversation.betaWorkflow?.verifiedExecutions?.at(-1);
    const recoveryChoiceAllowed =
      conversation.betaWorkflow?.status === "started" &&
      Boolean(conversation.betaWorkflow.confirmedNextStep) &&
      Boolean(latestEvidence) &&
      (latestEvidence?.result !== "passed" || !latestEvidence.doneWhenSatisfied) &&
      !conversation.betaWorkflow.incompleteExecutionRecoveries?.some(
        (recovery) => recovery.evidenceId === latestEvidence?.evidenceId,
      );
    const response: AuraAssistantPlan = {
      ...generatedResponse,
      experience: {
        ...generatedResponse.experience,
        choices: recoveryChoiceAllowed
          ? incompleteExecutionRecoveryChoices()
          : sessionDecisionAllowed
            ? readyToStartChoices()
          : generatedResponse.experience.choices.filter(
          (choice) =>
            (choice.confirmation?.kind !== "beta-incomplete-execution-recovery" ||
              recoveryChoiceAllowed) &&
            (choice.confirmation?.kind !== "beta-session-closure" || closureChoiceAllowed) &&
            (choice.confirmation?.kind !== "beta-next-step" || nextStepAllowed) &&
            (choice.confirmation?.kind !== "beta-session-decision" ||
              sessionDecisionAllowed ||
              (conversation.betaWorkflow?.status === "deferred" &&
                choice.confirmation.decision === "start-now")) &&
            (choice.confirmation?.kind !== "beta-post-closure-handoff" ||
              handoffChoiceAllowed) &&
            (conversation.betaWorkflow?.status !== "closed" ||
              !isBetaConfirmation(choice.confirmation) ||
              choice.confirmation?.kind === "beta-post-closure-handoff"),
          ),
      },
    };
    if (!evaluationAllowed) delete response.betaExecutionEvaluation;
    if (!sessionEvaluationAllowed) delete response.betaSessionEvaluation;
    if (!nextStepAllowed) delete response.betaNextStep;

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
            assistantMessageMetadata(
              response,
              response.betaExecutionEvaluation
                ? userMessage.messageId
                : undefined,
            ),
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

    await this.flushConversationPersistence(
      "assistant_message",
      conversation.conversationId,
      userMessage.messageId,
    );

    const authoritativeExperience = assistantWrite.message.structuredResponse?.experience;
    return {
      plan: authoritativeExperience ? { ...response, experience: authoritativeExperience } : response,
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

  resumeDeferredFromContinuity(
    request: DeferredContinuityResumeRequest,
  ): Conversation {
    const activeProject = this.projects.getActiveProject();
    const conversation = this.conversations.getActiveConversation(request.projectId);
    const workflow = conversation?.betaWorkflow;
    const provenance = workflow
      ? deferredContinuityProvenance(workflow)
      : undefined;
    if (
      activeProject?.id !== request.projectId ||
      !conversation ||
      conversation.projectId !== request.projectId ||
      conversation.conversationId !== request.conversationId ||
      conversation.revision !== request.expectedRevision ||
      workflow?.status !== "deferred" ||
      !workflow.confirmedContext ||
      !workflow.confirmedOutcome ||
      !workflow.confirmedNextStep ||
      workflow.confirmedNextStep.sourceMessageId !== request.stepSourceMessageId ||
      !provenance ||
      provenance !== request.deferSourceMessageId
    ) {
      throw new ConversationTurnError(
        "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE",
        "conversation",
        conversation?.conversationId,
      );
    }

    const latestEvidence = workflow.verifiedExecutions?.at(-1);
    const latestRecovery = latestEvidence
      ? workflow.incompleteExecutionRecoveries?.find(
          (recovery) => recovery.evidenceId === latestEvidence.evidenceId,
        )
      : undefined;
    const afterTimestamp = latestRecovery?.confirmedAt ?? workflow.sessionDecision?.decidedAt;
    const requestedTimestamp = this.now();
    const decidedAt = afterTimestamp &&
      Date.parse(requestedTimestamp) <= Date.parse(afterTimestamp)
      ? new Date(Date.parse(afterTimestamp) + 1).toISOString()
      : requestedTimestamp;
    const auditSource = this.conversations.appendMessage(
      conversation.conversationId,
      {
        role: "assistant",
        content: "El fundador retomó el mismo paso confirmado desde la continuidad del proyecto.",
        structuredResponse: {
          actionTypes: [],
          experienceKind: "decision",
          recommendedSurface: "presence",
          experience: {
            kind: "decision",
            title: "Paso retomado",
            summary: "La evidencia anterior permanece preservada.",
            phases: [],
            choices: [{
              label: "Empezar ahora",
              description: "Reanudación confirmada desde la continuidad del proyecto.",
              prompt: "Retomar el mismo paso confirmado.",
              confirmation: {
                kind: "beta-session-decision",
                decision: "start-now",
              },
            }],
            recommendedSurface: "presence",
          },
        },
      },
      this.conversations.getRevision(),
    );
    if (!auditSource.ok || !auditSource.message) {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        "conversation",
        conversation.conversationId,
      );
    }
    const write = this.conversations.updateConversationMetadata(
      conversation.conversationId,
      {
        betaWorkflow: {
          ...workflow,
          status: "started",
          sessionDecision: {
            kind: "start-now",
            sourceMessageId: auditSource.message.messageId,
            decidedAt,
          },
        },
      },
    );
    const updated = this.conversations.getConversation(conversation.conversationId);
    if (!write.ok || !updated || updated.betaWorkflow?.status !== "started") {
      throw new ConversationTurnError(
        "IAURA_CONVERSATION_PERSISTENCE_FAILED",
        "conversation",
        conversation.conversationId,
      );
    }
    return updated;
  }

  private async resolveIntelligenceChoice(
    conversation: Conversation,
    sourceMessage: ConversationMessage,
    persistedChoice: AuraExperienceChoice,
    confirmation: Extract<AuraExperienceChoice["confirmation"], { kind: "intelligence-action" }>,
  ): Promise<ConversationTurnResult> {
    const previousReceipt = conversation.messages.find((message) =>
      message.verifiedActionReceiptReferences?.includes(sourceMessage.messageId));
    if (previousReceipt) {
      const duplicatePlan: AuraAssistantPlan = {
        content: previousReceipt.content,
        actions: [], memoryUpdates: [],
        experience: { kind: "decision", title: "Intelligence receipt", summary: previousReceipt.content, phases: [], choices: [], recommendedSurface: "intelligence" },
      };
      return { plan: duplicatePlan, assistantMessageId: previousReceipt.messageId };
    }

    let authoritativeConversation = conversation;
    const confirmationExpectedRevision = this.conversations.getRevision();
    let confirmationMessage: ConversationMessage;
    try {
      confirmationMessage = await this.persistUserMessage(conversation, persistedChoice.prompt);
    } catch (error) {
      if (!(error instanceof AuthenticatedConversationPersistenceError) || error.code !== "IAURA_STATE_STALE_WRITE") throw error;
      const refreshed = this.conversations.getConversation(conversation.conversationId);
      const refreshedSource = refreshed?.messages.find((message) =>
        message.messageId === sourceMessage.messageId && message.role === "assistant");
      const exactChoiceStillAuthoritative = refreshedSource?.structuredResponse?.experience?.choices.some(
        (candidate) => sameChoice(candidate, persistedChoice),
      );
      if (!refreshed || !refreshedSource || !exactChoiceStillAuthoritative) {
        console.warn("Intelligence confirmation rejected after conversation CAS conflict.", {
          code: "IAURA_STATE_STALE_WRITE",
          conversationId: conversation.conversationId,
          sourceMessageId: sourceMessage.messageId,
          expectedRevision: confirmationExpectedRevision,
          currentRevision: this.conversations.getRevision(),
        });
        throw new ConversationTurnError(
          "IAURA_CONVERSATION_STALE_CONFIRMATION", "conversation", conversation.conversationId,
        );
      }
      authoritativeConversation = refreshed;
      confirmationMessage = await this.persistUserMessage(refreshed, persistedChoice.prompt);
    }
    const resultReceipt: IntelligenceActionReceipt = confirmation.decision === "cancel"
      ? {
          receiptId: `intelligence-${crypto.randomUUID()}`,
          sourceMessageId: sourceMessage.messageId,
          operation: confirmation.proposal.operation,
          scopeType: confirmation.proposal.scopeType,
          projectId: confirmation.proposal.projectId,
          status: "cancelled",
          summary: "Intelligence proposal cancelled. No change was applied.",
        }
      : await this.intelligenceMutationExecutor.execute(
          confirmation.proposal,
          sourceMessage.messageId,
          this.projects.getActiveProject(),
        );
    const receiptContent = [
      "INTELLIGENCE ACTION RECEIPT",
      `Status: ${resultReceipt.status}`,
      `Scope: ${resultReceipt.scopeType === "global" ? "Global" : `Project — ${confirmation.proposal.projectName ?? resultReceipt.projectId}`}`,
      resultReceipt.summary,
    ].join("\n");
    const receiptPlan: AuraAssistantPlan = {
      content: receiptContent,
      actions: [], memoryUpdates: [],
      experience: { kind: "decision", title: "Intelligence receipt", summary: resultReceipt.summary, phases: [], choices: [], recommendedSurface: "intelligence" },
    };
    const write = this.conversations.appendMessage(authoritativeConversation.conversationId, {
      role: "assistant",
      content: receiptContent,
      structuredResponse: assistantMessageMetadata(receiptPlan, confirmationMessage.messageId),
      verifiedActionReceiptReferences: [sourceMessage.messageId, resultReceipt.receiptId],
    });
    if (!write.ok || !write.message) {
      console.error(
        "Intelligence receipt local persistence failed after deterministic execution.",
        { conversationId: authoritativeConversation.conversationId, sourceMessageId: sourceMessage.messageId, receiptId: resultReceipt.receiptId },
      );
      return { plan: receiptPlan, assistantMessageId: resultReceipt.receiptId };
    }
    try {
      await this.flushConversationPersistence("assistant_message", authoritativeConversation.conversationId, confirmationMessage.messageId);
    } catch (error) {
      console.error("Intelligence receipt remote persistence failed after deterministic execution.", error);
    }
    return { plan: receiptPlan, assistantMessageId: write.message.messageId };
  }

  async sendChoice(
    choice: AuraExperienceChoice,
    sourceMessageId: string,
    userContext: string,
  ): Promise<ConversationTurnResult> {
    const intelligenceSourceConversation = choice.confirmation?.kind === "intelligence-action"
      ? this.conversations.listConversations().find((candidate) =>
          candidate.messages.some((message) =>
            message.messageId === sourceMessageId && message.role === "assistant"))
      : undefined;
    const conversation = intelligenceSourceConversation ?? this.resolveConversation();
    const sourceMessage = conversation.messages.find(
      (message) => message.messageId === sourceMessageId && message.role === "assistant",
    );
    const persistedChoice = sourceMessage?.structuredResponse?.experience?.choices.find(
      (candidate) => sameChoice(candidate, choice),
    );

    if (process.env.NODE_ENV !== "production") {
      const persistedIntelligenceChoices = sourceMessage?.structuredResponse?.experience?.choices.filter(
        (candidate) => candidate.confirmation?.kind === "intelligence-action",
      ) ?? [];
      const requestedConfirmation = choice.confirmation?.kind === "intelligence-action" ? choice.confirmation : null;
      const executionIds = persistedIntelligenceChoices.flatMap((candidate) =>
        candidate.confirmation?.kind === "intelligence-action" && candidate.confirmation.proposal.executionId
          ? [candidate.confirmation.proposal.executionId] : []);
      console.debug("Intelligence confirmation authority check.", {
        conversationId: conversation.conversationId,
        repositoryRevision: this.conversations.getRevision(),
        remoteRevision: "not-fetched",
        sourceMessageId,
        sourceMessageExists: Boolean(sourceMessage),
        sourceRole: sourceMessage?.role ?? null,
        persistedChoiceCount: sourceMessage?.structuredResponse?.experience?.choices.length ?? 0,
        exactChoiceMatched: Boolean(persistedChoice),
        confirmationKind: requestedConfirmation?.kind ?? choice.confirmation?.kind ?? null,
        operation: requestedConfirmation?.proposal.operation ?? null,
        executionId: requestedConfirmation?.proposal.executionId ?? null,
        pairedExecutionIdMatches: executionIds.length === 2 && new Set(executionIds).size === 1,
      });
    }

    if (!sourceMessage || !persistedChoice) {
      throw new ConversationTurnError(
        "IAURA_BETA_CONFIRMATION_INVALID",
        "conversation",
        conversation.conversationId,
      );
    }

    const confirmation = persistedChoice.confirmation;

    if (confirmation?.kind === "intelligence-action") {
      const confirmationKey = `${conversation.conversationId}:${sourceMessage.messageId}`;
      const pendingConfirmation = this.pendingIntelligenceConfirmations.get(confirmationKey);
      if (pendingConfirmation) return pendingConfirmation;

      const execution = this.resolveIntelligenceChoice(
        conversation,
        sourceMessage,
        persistedChoice,
        confirmation,
      );
      this.pendingIntelligenceConfirmations.set(confirmationKey, execution);
      try {
        return await execution;
      } finally {
        if (this.pendingIntelligenceConfirmations.get(confirmationKey) === execution) {
          this.pendingIntelligenceConfirmations.delete(confirmationKey);
        }
      }
    }

    if (
      conversation.betaWorkflow?.status === "closed" &&
      isBetaConfirmation(confirmation) &&
      confirmation?.kind !== "beta-post-closure-handoff"
    ) {
      throw new ConversationTurnError(
        "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE",
        "conversation",
        conversation.conversationId,
      );
    }

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
      const existing = conversation.betaWorkflow?.confirmedNextStep;
      const alreadyConfirmed =
        existing?.sourceMessageId === sourceMessage.messageId &&
        existing.action === confirmation.action &&
        existing.whyNow === confirmation.whyNow &&
        existing.result === confirmation.result &&
        existing.doneWhen === confirmation.doneWhen &&
        conversation.betaWorkflow?.status === "ready-to-start";
      if (
        !conversation.betaWorkflow?.confirmedContext ||
        !conversation.betaWorkflow.confirmedOutcome ||
        (conversation.betaWorkflow.status !== "recommended" && !alreadyConfirmed) ||
        !sameNextStep(sourceMessage.structuredResponse?.betaNextStep, confirmation)
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_INVALID",
          "conversation",
          conversation.conversationId,
        );
      }

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
      const isDeferredRestart =
        workflow?.status === "deferred" && confirmation.decision === "start-now";
      if (
        !workflow?.confirmedContext ||
        !workflow.confirmedOutcome ||
        !workflow.confirmedNextStep ||
        (workflow.status !== "ready-to-start" && !isDeferredRestart)
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

    if (confirmation?.kind === "beta-execution-evaluation") {
      const workflow = conversation.betaWorkflow;
      const evaluation = sourceMessage.structuredResponse?.betaExecutionEvaluation;
      const sourceUserMessageId = sourceMessage.structuredResponse?.sourceUserMessageId;
      const sourceMessageIndex = conversation.messages.findIndex(
        (message) => message.messageId === sourceMessage.messageId,
      );
      const sourceUserMessageIndex = sourceUserMessageId
        ? conversation.messages.findIndex(
            (message) =>
              message.messageId === sourceUserMessageId && message.role === "user",
          )
        : -1;
      if (
        !workflow?.confirmedContext ||
        !workflow.confirmedOutcome ||
        !workflow.confirmedNextStep ||
        workflow.status !== "started" ||
        !sameExecutionEvaluation(evaluation, confirmation) ||
        sourceUserMessageIndex < 0 ||
        sourceUserMessageIndex >= sourceMessageIndex
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_INVALID",
          "conversation",
          conversation.conversationId,
        );
      }

      const alreadyVerified = workflow.verifiedExecutions?.some(
        (evidence) => evidence.sourceMessageId === sourceMessage.messageId,
      );
      const write = alreadyVerified
        ? { ok: true, outcome: "unchanged" as const }
        : this.conversations.updateConversationMetadata(
            conversation.conversationId,
            {
              betaWorkflow: {
                ...workflow,
                status:
                  confirmation.result === "passed" && confirmation.doneWhenSatisfied
                    ? "evaluated"
                    : "started",
                verifiedExecutions: [
                  ...(workflow.verifiedExecutions ?? []),
                  {
                    evidenceId: this.evidenceIdFactory(),
                    result: confirmation.result,
                    observation: confirmation.observation,
                    doneWhenSatisfied: confirmation.doneWhenSatisfied,
                    sourceUserMessageId: sourceUserMessageId!,
                    sourceMessageId: sourceMessage.messageId,
                    verifiedAt: this.now(),
                  },
                ],
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

    if (confirmation?.kind === "beta-incomplete-execution-recovery") {
      const workflow = conversation.betaWorkflow;
      const latestEvidence = workflow?.verifiedExecutions?.at(-1);
      const sourceMessageIndex = conversation.messages.findIndex(
        (message) => message.messageId === sourceMessage.messageId,
      );
      const evidenceSourceIndex = latestEvidence
        ? conversation.messages.findIndex(
            (message) => message.messageId === latestEvidence.sourceMessageId,
          )
        : -1;
      const latestAssistantMessage = conversation.messages.findLast(
        (message) => message.role === "assistant",
      );
      if (
        !workflow?.confirmedContext ||
        !workflow.confirmedOutcome ||
        !workflow.confirmedNextStep ||
        workflow.status !== "started" ||
        !latestEvidence ||
        (latestEvidence.result === "passed" && latestEvidence.doneWhenSatisfied) ||
        workflow.incompleteExecutionRecoveries?.some(
          (recovery) => recovery.evidenceId === latestEvidence.evidenceId,
        ) ||
        sourceMessageIndex <= evidenceSourceIndex ||
        latestAssistantMessage?.messageId !== sourceMessage.messageId
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
            status: confirmation.decision === "retry-now" ? "started" : "deferred",
            incompleteExecutionRecoveries: [
              ...(workflow.incompleteExecutionRecoveries ?? []),
              {
                decision: confirmation.decision,
                sourceMessageId: sourceMessage.messageId,
                confirmedAt: this.now(),
                evidenceId: latestEvidence.evidenceId,
              },
            ],
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

    if (confirmation?.kind === "beta-session-evaluation") {
      const workflow = conversation.betaWorkflow;
      if (
        workflow?.status !== "evaluated" ||
        !workflow.confirmedContext ||
        !workflow.confirmedOutcome?.doneWhen ||
        !workflow.confirmedNextStep ||
        !workflow.verifiedExecutions?.some(
          (evidence) => evidence.result === "passed" && evidence.doneWhenSatisfied,
        ) ||
        workflow.sessionEvaluation ||
        !sameSessionEvaluation(
          sourceMessage.structuredResponse?.betaSessionEvaluation,
          confirmation,
        )
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_INVALID",
          "conversation",
          conversation.conversationId,
        );
      }
      const write = this.conversations.updateConversationMetadata(
        conversation.conversationId,
        {
          betaWorkflow: {
            ...workflow,
            sessionEvaluation: {
              outcomeSatisfied: confirmation.outcomeSatisfied,
              summary: confirmation.summary,
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

    if (confirmation?.kind === "beta-session-closure") {
      const workflow = conversation.betaWorkflow;
      if (
        workflow?.status !== "evaluated" ||
        !workflow.confirmedContext ||
        !workflow.confirmedOutcome ||
        !workflow.confirmedNextStep ||
        workflow.sessionDecision?.kind !== "start-now" ||
        !workflow.verifiedExecutions?.some(
          (evidence) => evidence.result === "passed" && evidence.doneWhenSatisfied,
        ) ||
        workflow.sessionEvaluation?.outcomeSatisfied !== true ||
        workflow.sessionClosure
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_INVALID",
          "conversation",
          conversation.conversationId,
        );
      }
      const write = this.conversations.updateConversationMetadata(
        conversation.conversationId,
        {
          betaWorkflow: {
            ...workflow,
            status: "closed",
            sessionClosure: {
              sourceMessageId: sourceMessage.messageId,
              closedAt: this.now(),
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

    if (confirmation?.kind === "beta-post-closure-handoff") {
      const workflow = conversation.betaWorkflow;
      if (
        workflow?.status !== "closed" ||
        !workflow.confirmedContext ||
        !workflow.confirmedOutcome ||
        !workflow.confirmedNextStep ||
        workflow.sessionDecision?.kind !== "start-now" ||
        !workflow.verifiedExecutions?.some(
          (evidence) => evidence.result === "passed" && evidence.doneWhenSatisfied,
        ) ||
        workflow.sessionEvaluation?.outcomeSatisfied !== true ||
        !workflow.sessionClosure ||
        workflow.postClosureHandoff
      ) {
        throw new ConversationTurnError(
          "IAURA_BETA_CONFIRMATION_INVALID",
          "conversation",
          conversation.conversationId,
        );
      }

      const closedWorkflow = {
        ...workflow,
        postClosureHandoff: {
          decision: confirmation.decision,
          sourceMessageId: sourceMessage.messageId,
          confirmedAt: this.now(),
        },
      };
      const write = this.conversations.updateConversationMetadata(
        conversation.conversationId,
        confirmation.decision === "begin-another-cycle"
          ? {
              completedBetaWorkflows: [
                ...(conversation.completedBetaWorkflows ?? []),
                closedWorkflow,
              ],
              betaWorkflow: null,
            }
          : { betaWorkflow: closedWorkflow },
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
      {
        allowBetaExecutionEvaluation:
          confirmation?.kind !== "beta-execution-evaluation" &&
          confirmation?.kind !== "beta-incomplete-execution-recovery",
        allowBetaSessionEvaluation:
          confirmation?.kind !== "beta-session-evaluation",
      },
    );
  }
}

export const conversationController =
  new ConversationController({
    conversations:
      process.env.NODE_ENV === "test"
        ? conversationRepository
        : authenticatedConversationRepository,
    projects:
      process.env.NODE_ENV === "test"
        ? projectRepository
        : authenticatedProjectRepository,
  });
