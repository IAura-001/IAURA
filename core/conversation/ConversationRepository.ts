import {
  atomicWriteState,
  createWriterId,
  parseLocalState,
  readLocalState,
  removeLocalState,
  reportStateDiagnostic,
  schemaVersionOf,
  writeLocalState,
  type MigrationOutcome,
  type StateOperationResult,
  type VersionedLocalState,
} from "@/core/storage/StateReliability";
import {
  AURA_EXPERIENCE_KINDS,
  AURA_EXPERIENCE_SURFACES,
  IAURA_ACTION_TYPES,
  type AuraAssistantPlan,
  type BetaNextStepRecommendation,
  type AuraExperience,
  type AuraExperienceKind,
  type AuraExperienceSurface,
  type IAuraActionType,
} from "@/core/actions";

export const CONVERSATION_STATE_STORAGE_KEY = "iaura.conversation-state";
export const CONVERSATION_STATE_VERSION = 1;
export const CONVERSATION_STAGING_STORAGE_KEY =
  `${CONVERSATION_STATE_STORAGE_KEY}.staging`;
export const CONVERSATION_BACKUP_STORAGE_KEY =
  `${CONVERSATION_STATE_STORAGE_KEY}.backup`;
export const LEGACY_CONVERSATION_STORAGE_KEYS = [
  "iaura.conversation-memory",
  "iaura.conversation-history",
] as const;

export const MAX_WORKING_HISTORY_MESSAGES = 24;
export const MAX_WORKING_HISTORY_CHARACTERS = 12_000;
const MAX_RECEIPT_HISTORY_MESSAGES = 4;
const MAX_RECEIPT_HISTORY_CHARACTERS = 3_000;

export type ConversationStatus = "active" | "archived" | "deleted";
export type ConversationRole = "user" | "assistant";

export const BETA_WORKFLOW_VERSION = 1;
export const BETA_WORKFLOW_STATUSES = [
  "capturing",
  "confirming-context",
  "defining-outcome",
  "recommended",
  "started",
  "pending",
  "evaluated",
  "closed",
] as const;

export type BetaWorkflowStatus =
  (typeof BETA_WORKFLOW_STATUSES)[number];

export interface BetaWorkflowMetadata {
  version: typeof BETA_WORKFLOW_VERSION;
  status: BetaWorkflowStatus;
  confirmedContext?: {
    goal: string;
    blocker: string;
    summary: string;
    sourceMessageId: string;
    confirmedAt: string;
  };
  confirmedOutcome?: {
    outcome: string;
    doneWhen: string;
    sourceMessageId: string;
    confirmedAt: string;
  };
}

export interface ConversationStructuredResponse {
  actionTypes: IAuraActionType[];
  experienceKind: AuraExperienceKind;
  recommendedSurface: AuraExperienceSurface;
  experience?: AuraExperience;
  betaNextStep?: BetaNextStepRecommendation;
}

export interface ConversationMessage {
  messageId: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
  structuredResponse?: ConversationStructuredResponse;
  verifiedActionReceiptReferences?: string[];
}

export interface ConversationSummaryMetadata {
  content: string;
  sourceMessageCount: number;
  updatedAt: string;
}

export interface Conversation {
  conversationId: string;
  projectId?: string;
  goalId?: string;
  missionId?: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  revision: number;
  messages: ConversationMessage[];
  summary?: ConversationSummaryMetadata;
  betaWorkflow?: BetaWorkflowMetadata;
}

export interface ConversationRepositorySnapshot {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writerId: string;
  migrationCompletedAt: string;
  activeConversationId: string | null;
  conversations: Conversation[];
}

export interface CreateConversationInput {
  conversationId?: string;
  projectId?: string;
  goalId?: string;
  missionId?: string;
  title?: string;
}

export interface AppendConversationMessageInput {
  messageId?: string;
  role: ConversationRole;
  content: string;
  createdAt?: string;
  structuredResponse?: ConversationMessage["structuredResponse"];
  verifiedActionReceiptReferences?: string[];
}

export interface ConversationMetadataUpdate {
  title?: string;
  goalId?: string | null;
  missionId?: string | null;
  summary?: ConversationSummaryMetadata | null;
  betaWorkflow?: BetaWorkflowMetadata | null;
}

export interface ConversationWriteResult extends StateOperationResult {
  conversation?: Conversation;
  persisted: boolean;
  created?: boolean;
}

export interface ConversationMessageWriteResult extends StateOperationResult {
  conversation?: Conversation;
  message?: ConversationMessage;
  persisted: boolean;
}

export interface WorkingHistoryOptions {
  excludeMessageId?: string;
  maxMessages?: number;
  maxCharacters?: number;
}

type ConversationRepositoryListener = () => void;

export interface ConversationRepository {
  getSnapshot(): ConversationRepositorySnapshot;
  listConversations(options?: { includeArchived?: boolean }): Conversation[];
  getConversation(conversationId: string): Conversation | null;
  getActiveConversation(projectId?: string | null): Conversation | null;
  createConversation(input?: CreateConversationInput): ConversationWriteResult;
  setActiveConversation(conversationId: string): StateOperationResult;
  appendMessage(
    conversationId: string,
    input: AppendConversationMessageInput,
    expectedRevision?: number,
  ): ConversationMessageWriteResult;
  updateConversationMetadata(
    conversationId: string,
    update: ConversationMetadataUpdate,
  ): ConversationWriteResult;
  associateWithProject(
    conversationId: string,
    projectId: string | null,
  ): ConversationWriteResult;
  archiveConversation(conversationId: string): StateOperationResult;
  deleteConversation(conversationId: string): StateOperationResult;
  clearAllConversations(): StateOperationResult;
  getWorkingHistory(
    conversationId: string,
    options?: WorkingHistoryOptions,
  ): ConversationMessage[];
  getRevision(): number;
  getMigrationOutcome(): MigrationOutcome;
  getLastOperationResult(): StateOperationResult;
  subscribe(listener: ConversationRepositoryListener): () => void;
}

interface LocalConversationRepositoryOptions {
  synchronize?: boolean;
  writerId?: string;
  now?: () => string;
  idFactory?: () => string;
}

type CurrentConversationState = ConversationRepositorySnapshot &
  VersionedLocalState;

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isConversationStatus(value: unknown): value is ConversationStatus {
  return value === "active" || value === "archived" || value === "deleted";
}

function isConversationRole(value: unknown): value is ConversationRole {
  return value === "user" || value === "assistant";
}

function isActionType(value: unknown): value is IAuraActionType {
  return typeof value === "string" && IAURA_ACTION_TYPES.includes(value as IAuraActionType);
}

function isExperienceKind(value: unknown): value is AuraExperienceKind {
  return (
    typeof value === "string" &&
    AURA_EXPERIENCE_KINDS.includes(value as AuraExperienceKind)
  );
}

function isExperienceSurface(value: unknown): value is AuraExperienceSurface {
  return (
    typeof value === "string" &&
    AURA_EXPERIENCE_SURFACES.includes(value as AuraExperienceSurface)
  );
}

function isBetaWorkflowStatus(value: unknown): value is BetaWorkflowStatus {
  return (
    typeof value === "string" &&
    BETA_WORKFLOW_STATUSES.includes(value as BetaWorkflowStatus)
  );
}

function normalizeBetaWorkflow(value: unknown): BetaWorkflowMetadata | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.version !== BETA_WORKFLOW_VERSION ||
    !isBetaWorkflowStatus(value.status)
  ) {
    return undefined;
  }

  const context = isRecord(value.confirmedContext) &&
    isNonEmptyString(value.confirmedContext.goal) &&
    isNonEmptyString(value.confirmedContext.blocker) &&
    isNonEmptyString(value.confirmedContext.summary) &&
    isNonEmptyString(value.confirmedContext.sourceMessageId) &&
    isIsoDate(value.confirmedContext.confirmedAt)
      ? {
          goal: value.confirmedContext.goal.trim().slice(0, 500),
          blocker: value.confirmedContext.blocker.trim().slice(0, 500),
          summary: value.confirmedContext.summary.trim().slice(0, 1000),
          sourceMessageId: value.confirmedContext.sourceMessageId.trim(),
          confirmedAt: value.confirmedContext.confirmedAt,
        }
      : undefined;
  const outcome = isRecord(value.confirmedOutcome) &&
    isNonEmptyString(value.confirmedOutcome.outcome) &&
    isNonEmptyString(value.confirmedOutcome.doneWhen) &&
    isNonEmptyString(value.confirmedOutcome.sourceMessageId) &&
    isIsoDate(value.confirmedOutcome.confirmedAt)
      ? {
          outcome: value.confirmedOutcome.outcome.trim().slice(0, 1000),
          doneWhen: value.confirmedOutcome.doneWhen.trim().slice(0, 1000),
          sourceMessageId: value.confirmedOutcome.sourceMessageId.trim(),
          confirmedAt: value.confirmedOutcome.confirmedAt,
        }
      : undefined;

  return {
    version: BETA_WORKFLOW_VERSION,
    status: value.status,
    ...(context ? { confirmedContext: context } : {}),
    ...(outcome && context ? { confirmedOutcome: outcome } : {}),
  };
}

function hasUnsupportedBetaWorkflowVersion(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.conversations)) return false;

  return value.conversations.some((conversation) => {
    if (!isRecord(conversation) || !isRecord(conversation.betaWorkflow)) {
      return false;
    }
    const version = conversation.betaWorkflow.version;
    return (
      typeof version === "number" &&
      Number.isInteger(version) &&
      version > BETA_WORKFLOW_VERSION
    );
  });
}

function normalizeExperience(value: unknown): AuraExperience | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !isExperienceKind(value.kind) ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.phases) ||
    !Array.isArray(value.choices) ||
    !isExperienceSurface(value.recommendedSurface)
  ) {
    return undefined;
  }

  const phases = value.phases.slice(0, 5).flatMap((phase) => {
    if (
      !isRecord(phase) ||
      typeof phase.title !== "string" ||
      typeof phase.description !== "string"
    ) {
      return [];
    }
    return [{
      title: phase.title.trim().slice(0, 100),
      description: phase.description.trim().slice(0, 240),
    }];
  }).filter((phase) => phase.title.length > 0);

  const choices = value.choices.slice(0, 4).flatMap((choice) => {
    if (
      !isRecord(choice) ||
      typeof choice.label !== "string" ||
      typeof choice.description !== "string" ||
      typeof choice.prompt !== "string"
    ) {
      return [];
    }
    const label = choice.label.trim().slice(0, 80);
    const prompt = choice.prompt.trim().slice(0, 600);
    if (!label || !prompt) return [];

    const rawConfirmation = choice.confirmation;
    const confirmation = (() => {
      if (!isRecord(rawConfirmation)) return undefined;
      if (
        rawConfirmation.kind === "project-decision" &&
        isNonEmptyString(rawConfirmation.content)
      ) return {
        kind: "project-decision" as const,
        content: rawConfirmation.content.trim().slice(0, 600),
      };
      if (
        rawConfirmation.kind === "beta-context" &&
        isNonEmptyString(rawConfirmation.goal) &&
        isNonEmptyString(rawConfirmation.blocker) &&
        isNonEmptyString(rawConfirmation.summary)
      ) return {
        kind: "beta-context" as const,
        goal: rawConfirmation.goal.trim().slice(0, 500),
        blocker: rawConfirmation.blocker.trim().slice(0, 500),
        summary: rawConfirmation.summary.trim().slice(0, 1000),
      };
      if (
        rawConfirmation.kind === "beta-outcome" &&
        isNonEmptyString(rawConfirmation.outcome) &&
        isNonEmptyString(rawConfirmation.doneWhen)
      ) return {
        kind: "beta-outcome" as const,
        outcome: rawConfirmation.outcome.trim().slice(0, 1000),
        doneWhen: rawConfirmation.doneWhen.trim().slice(0, 1000),
      };
      return undefined;
    })();

    return [{
      label,
      description: choice.description.trim().slice(0, 220),
      prompt,
      ...(confirmation ? { confirmation } : {}),
    }];
  });

  return {
    kind: value.kind,
    title: value.title.trim().slice(0, 120),
    summary: value.summary.trim().slice(0, 400),
    phases,
    choices,
    recommendedSurface: value.recommendedSurface,
  };
}

function normalizeBetaNextStep(
  value: unknown,
): BetaNextStepRecommendation | undefined {
  if (!isRecord(value)) return undefined;

  const fields = [value.action, value.whyNow, value.result, value.doneWhen];
  if (!fields.every(isNonEmptyString)) return undefined;

  return {
    action: (value.action as string).trim().slice(0, 1000),
    whyNow: (value.whyNow as string).trim().slice(0, 1000),
    result: (value.result as string).trim().slice(0, 1000),
    doneWhen: (value.doneWhen as string).trim().slice(0, 1000),
  };
}

function normalizeStringReferences(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const references = value.filter(isNonEmptyString).map((item) => item.trim());
  return references.length > 0 ? [...new Set(references)] : undefined;
}

function normalizeStructuredResponse(
  value: unknown,
): ConversationMessage["structuredResponse"] | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !Array.isArray(value.actionTypes) ||
    !value.actionTypes.every(isActionType) ||
    !isExperienceKind(value.experienceKind) ||
    !isExperienceSurface(value.recommendedSurface)
  ) {
    return undefined;
  }

  const experience = normalizeExperience(value.experience);
  const betaNextStep = normalizeBetaNextStep(value.betaNextStep);
  return {
    actionTypes: [...new Set(value.actionTypes)],
    experienceKind: value.experienceKind,
    recommendedSurface: value.recommendedSurface,
    ...(experience ? { experience } : {}),
    ...(betaNextStep ? { betaNextStep } : {}),
  };
}

function normalizeMessage(value: unknown): ConversationMessage | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.messageId) ||
    !isConversationRole(value.role) ||
    typeof value.content !== "string" ||
    !value.content.trim() ||
    !isIsoDate(value.createdAt)
  ) {
    return null;
  }

  return {
    messageId: value.messageId.trim(),
    role: value.role,
    content: value.content,
    createdAt: value.createdAt,
    ...(normalizeStructuredResponse(value.structuredResponse)
      ? { structuredResponse: normalizeStructuredResponse(value.structuredResponse) }
      : {}),
    ...(normalizeStringReferences(value.verifiedActionReceiptReferences)
      ? {
          verifiedActionReceiptReferences: normalizeStringReferences(
            value.verifiedActionReceiptReferences,
          ),
        }
      : {}),
  };
}

function normalizeSummary(value: unknown): ConversationSummaryMetadata | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.content !== "string" ||
    !Number.isInteger(value.sourceMessageCount) ||
    (value.sourceMessageCount as number) < 0 ||
    !isIsoDate(value.updatedAt)
  ) {
    return undefined;
  }

  return {
    content: value.content,
    sourceMessageCount: value.sourceMessageCount as number,
    updatedAt: value.updatedAt,
  };
}

function normalizeConversation(value: unknown): Conversation | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.conversationId) ||
    !isNonEmptyString(value.title) ||
    !isConversationStatus(value.status) ||
    !isIsoDate(value.createdAt) ||
    !isIsoDate(value.updatedAt) ||
    !isIsoDate(value.lastAccessedAt) ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Array.isArray(value.messages)
  ) {
    return null;
  }

  const messages: ConversationMessage[] = [];
  const messageIds = new Set<string>();
  for (const candidate of value.messages) {
    const message = normalizeMessage(candidate);
    if (!message || messageIds.has(message.messageId)) continue;
    messageIds.add(message.messageId);
    messages.push(message);
  }

  const summary = normalizeSummary(value.summary);
  const betaWorkflow = normalizeBetaWorkflow(value.betaWorkflow);
  return {
    conversationId: value.conversationId.trim(),
    ...(isNonEmptyString(value.projectId) ? { projectId: value.projectId.trim() } : {}),
    ...(isNonEmptyString(value.goalId) ? { goalId: value.goalId.trim() } : {}),
    ...(isNonEmptyString(value.missionId) ? { missionId: value.missionId.trim() } : {}),
    title: value.title.trim(),
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastAccessedAt: value.lastAccessedAt,
    revision: value.revision as number,
    messages,
    ...(summary ? { summary } : {}),
    ...(betaWorkflow ? { betaWorkflow } : {}),
  };
}

function normalizeCurrentState(value: unknown): CurrentConversationState | null {
  if (!isRecord(value)) return null;
  if (
    value.schemaVersion !== CONVERSATION_STATE_VERSION ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !isIsoDate(value.updatedAt) ||
    !isNonEmptyString(value.writerId) ||
    !isIsoDate(value.migrationCompletedAt) ||
    !Array.isArray(value.conversations)
  ) {
    return null;
  }

  const conversations: Conversation[] = [];
  const conversationIds = new Set<string>();
  for (const candidate of value.conversations) {
    const conversation = normalizeConversation(candidate);
    if (!conversation) {
      reportStateDiagnostic(
        "conversation",
        "IAURA_STATE_CORRUPTED_RECORD_ISOLATED",
      );
      continue;
    }
    if (conversationIds.has(conversation.conversationId)) continue;
    conversationIds.add(conversation.conversationId);
    conversations.push(conversation);
  }

  const requestedActiveId =
    typeof value.activeConversationId === "string"
      ? value.activeConversationId
      : null;
  const activeConversationId = conversations.some(
    (conversation) =>
      conversation.conversationId === requestedActiveId &&
      conversation.status === "active",
  )
    ? requestedActiveId
    : selectFallbackConversation(conversations)?.conversationId ?? null;

  return {
    schemaVersion: CONVERSATION_STATE_VERSION,
    revision: value.revision as number,
    updatedAt: value.updatedAt,
    writerId: value.writerId.trim(),
    migrationCompletedAt: value.migrationCompletedAt,
    activeConversationId,
    conversations,
  };
}

function selectFallbackConversation(
  conversations: Conversation[],
  projectId?: string | null,
): Conversation | null {
  const matches = conversations
    .filter((conversation) => {
      if (conversation.status !== "active") return false;
      if (projectId === undefined) return true;
      return (conversation.projectId ?? null) === projectId;
    })
    .sort(
      (left, right) =>
        right.lastAccessedAt.localeCompare(left.lastAccessedAt) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.conversationId.localeCompare(right.conversationId),
    );

  return matches[0] ?? null;
}

function cloneMessage(message: ConversationMessage): ConversationMessage {
  return {
    ...message,
    ...(message.structuredResponse
      ? {
          structuredResponse: {
            ...message.structuredResponse,
            actionTypes: [...message.structuredResponse.actionTypes],
            ...(message.structuredResponse.experience
              ? {
                  experience: {
                    ...message.structuredResponse.experience,
                    phases: message.structuredResponse.experience.phases.map(
                      (phase) => ({ ...phase }),
                    ),
                    choices: message.structuredResponse.experience.choices.map(
                      (choice) => ({
                        ...choice,
                        ...(choice.confirmation
                          ? { confirmation: { ...choice.confirmation } }
                          : {}),
                      }),
                    ),
                  },
                }
              : {}),
            ...(message.structuredResponse.betaNextStep
              ? { betaNextStep: { ...message.structuredResponse.betaNextStep } }
              : {}),
          },
        }
      : {}),
    ...(message.verifiedActionReceiptReferences
      ? {
          verifiedActionReceiptReferences: [
            ...message.verifiedActionReceiptReferences,
          ],
        }
      : {}),
  };
}

function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map(cloneMessage),
    ...(conversation.summary ? { summary: { ...conversation.summary } } : {}),
    ...(conversation.betaWorkflow
      ? {
          betaWorkflow: {
            ...conversation.betaWorkflow,
            ...(conversation.betaWorkflow.confirmedContext
              ? { confirmedContext: { ...conversation.betaWorkflow.confirmedContext } }
              : {}),
            ...(conversation.betaWorkflow.confirmedOutcome
              ? { confirmedOutcome: { ...conversation.betaWorkflow.confirmedOutcome } }
              : {}),
          },
        }
      : {}),
  };
}

function cloneSnapshot(
  snapshot: CurrentConversationState,
): ConversationRepositorySnapshot {
  return {
    ...snapshot,
    conversations: snapshot.conversations.map(cloneConversation),
  };
}

function readLegacyMessages(value: unknown): Array<Pick<ConversationMessage, "role" | "content">> {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.messages)
      ? value.messages
      : [];

  return candidates.flatMap((candidate) => {
    if (
      !isRecord(candidate) ||
      !isConversationRole(candidate.role) ||
      typeof candidate.content !== "string" ||
      !candidate.content.trim()
    ) {
      return [];
    }
    return [{ role: candidate.role, content: candidate.content }];
  });
}

function structuredResponseFromPlan(
  plan: AuraAssistantPlan,
): NonNullable<ConversationMessage["structuredResponse"]> {
  return {
    actionTypes: [...new Set(plan.actions.map((action) => action.type))],
    experienceKind: plan.experience.kind,
    recommendedSurface: plan.experience.recommendedSurface,
    experience: normalizeExperience(plan.experience) ?? {
      kind: "general",
      title: "",
      summary: "",
      phases: [],
      choices: [],
      recommendedSurface: "none",
    },
    ...(plan.betaNextStep
      ? { betaNextStep: normalizeBetaNextStep(plan.betaNextStep) }
      : {}),
  };
}

export function assistantMessageMetadata(
  plan: AuraAssistantPlan,
): NonNullable<ConversationMessage["structuredResponse"]> {
  return structuredResponseFromPlan(plan);
}

export class LocalConversationRepository implements ConversationRepository {
  private state: CurrentConversationState;
  private canonicalRaw: string | null = null;
  private migrationOutcome: MigrationOutcome = "failed_safely";
  private lastResult: StateOperationResult;
  private readonly writerId: string;
  private readonly now: () => string;
  private readonly idFactory: () => string;
  private readonly listeners = new Set<ConversationRepositoryListener>();
  private readonly storageListener?: (event: StorageEvent) => void;
  private blockedByFutureVersion = false;

  constructor(options: LocalConversationRepositoryOptions = {}) {
    this.writerId = options.writerId ?? createWriterId();
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? createWriterId;
    this.state = this.loadAndMigrate();
    this.lastResult = {
      ok: this.migrationOutcome !== "failed_safely",
      outcome: this.migrationOutcome === "failed_safely" ? "failed" : "unchanged",
      revision: this.state.revision,
      ...(this.blockedByFutureVersion
        ? { code: "IAURA_STATE_UNSUPPORTED_VERSION" as const }
        : {}),
    };

    if (options.synchronize && typeof window !== "undefined") {
      this.storageListener = (event) => this.handleStorageEvent(event);
      window.addEventListener("storage", this.storageListener);
    }
  }

  private emptyState(): CurrentConversationState {
    const now = this.now();
    return {
      schemaVersion: CONVERSATION_STATE_VERSION,
      revision: 0,
      updatedAt: now,
      writerId: this.writerId,
      migrationCompletedAt: now,
      activeConversationId: null,
      conversations: [],
    };
  }

  private loadAndMigrate(): CurrentConversationState {
    const fallback = this.emptyState();
    if (!canUseStorage()) return fallback;

    const canonicalRead = readLocalState(CONVERSATION_STATE_STORAGE_KEY);
    const canonicalValue = parseLocalState(canonicalRead.value);
    const canonicalVersion = schemaVersionOf(canonicalValue);
    if (
      canonicalVersion !== null &&
      canonicalVersion > CONVERSATION_STATE_VERSION
    ) {
      this.blockedByFutureVersion = true;
      reportStateDiagnostic(
        "conversation",
        "IAURA_STATE_FUTURE_VERSION_REJECTED",
        { schemaVersion: canonicalVersion },
      );
      return fallback;
    }
    if (hasUnsupportedBetaWorkflowVersion(canonicalValue)) {
      this.blockedByFutureVersion = true;
      this.migrationOutcome = "failed_safely";
      reportStateDiagnostic(
        "conversation",
        "IAURA_STATE_FUTURE_VERSION_REJECTED",
        { betaWorkflowVersion: "unsupported" },
      );
      return fallback;
    }

    const canonical = normalizeCurrentState(canonicalValue);
    if (canonical) {
      this.canonicalRaw = canonicalRead.value;
      if (readLocalState(CONVERSATION_STAGING_STORAGE_KEY).value !== null) {
        removeLocalState(CONVERSATION_STAGING_STORAGE_KEY);
        this.migrationOutcome = "recovered";
        reportStateDiagnostic(
          "conversation",
          "IAURA_STATE_MIGRATION_RECOVERED",
        );
      } else {
        this.migrationOutcome = "already_current";
      }
      return canonical;
    }

    const backupRead = readLocalState(CONVERSATION_BACKUP_STORAGE_KEY);
    const backupValue = parseLocalState(backupRead.value);
    const backup = hasUnsupportedBetaWorkflowVersion(backupValue)
      ? null
      : normalizeCurrentState(backupValue);
    const stagedRead = readLocalState(CONVERSATION_STAGING_STORAGE_KEY);
    const stagedValue = parseLocalState(stagedRead.value);
    const staged = hasUnsupportedBetaWorkflowVersion(stagedValue)
      ? null
      : normalizeCurrentState(stagedValue);
    const recovered = backup ?? staged;
    if (recovered) {
      const raw = backup ? backupRead.value : stagedRead.value;
      if (raw && writeLocalState(CONVERSATION_STATE_STORAGE_KEY, raw)) {
        removeLocalState(CONVERSATION_STAGING_STORAGE_KEY);
        this.canonicalRaw = raw;
        this.migrationOutcome = "recovered";
        reportStateDiagnostic(
          "conversation",
          "IAURA_STATE_LAST_KNOWN_GOOD_RECOVERED",
          { source: backup ? "backup" : "staging" },
        );
        return recovered;
      }
    }

    const legacyMessages = LEGACY_CONVERSATION_STORAGE_KEYS.flatMap((key) =>
      readLegacyMessages(parseLocalState(readLocalState(key).value)),
    );
    const now = this.now();
    const legacyConversation: Conversation | null =
      legacyMessages.length > 0
        ? {
            conversationId: `conversation-${this.idFactory()}`,
            title: "General conversation",
            status: "active",
            createdAt: now,
            updatedAt: now,
            lastAccessedAt: now,
            revision: 1,
            messages: legacyMessages.map((message, index) => ({
              messageId: `message-${this.idFactory()}-${index}`,
              role: message.role,
              content: message.content,
              createdAt: now,
            })),
          }
        : null;
    const migrated: CurrentConversationState = {
      ...fallback,
      revision: 1,
      updatedAt: now,
      migrationCompletedAt: now,
      activeConversationId: legacyConversation?.conversationId ?? null,
      conversations: legacyConversation ? [legacyConversation] : [],
    };

    reportStateDiagnostic("conversation", "IAURA_STATE_MIGRATION_STARTED");
    const write = atomicWriteState({
      scope: "conversation",
      storageKey: CONVERSATION_STATE_STORAGE_KEY,
      stagingKey: CONVERSATION_STAGING_STORAGE_KEY,
      backupKey: CONVERSATION_BACKUP_STORAGE_KEY,
      expectedCanonicalRaw: canonicalRead.value,
      state: migrated,
      validate: normalizeCurrentState,
    });
    if (write.result.ok) {
      this.canonicalRaw = write.canonicalRaw ?? null;
      this.migrationOutcome = legacyConversation ? "migrated" : "already_current";
      reportStateDiagnostic(
        "conversation",
        "IAURA_STATE_MIGRATION_COMPLETED",
        { revision: migrated.revision },
      );
    }
    return migrated;
  }

  private commit(
    snapshot: ConversationRepositorySnapshot,
    expectedRevision = this.state.revision,
  ): StateOperationResult {
    if (this.blockedByFutureVersion) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_UNSUPPORTED_VERSION",
      });
    }
    if (expectedRevision !== this.state.revision) {
      return this.remember({
        ok: false,
        outcome: "conflict",
        revision: this.state.revision,
        code: "IAURA_STATE_STALE_WRITE",
      });
    }

    const now = this.now();
    const candidate = normalizeCurrentState({
      ...snapshot,
      schemaVersion: CONVERSATION_STATE_VERSION,
      revision: this.state.revision + 1,
      updatedAt: now,
      writerId: this.writerId,
      migrationCompletedAt: this.state.migrationCompletedAt,
    });
    if (!candidate) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      });
    }

    const write = atomicWriteState({
      scope: "conversation",
      storageKey: CONVERSATION_STATE_STORAGE_KEY,
      stagingKey: CONVERSATION_STAGING_STORAGE_KEY,
      backupKey: CONVERSATION_BACKUP_STORAGE_KEY,
      expectedCanonicalRaw: this.canonicalRaw,
      state: candidate,
      validate: normalizeCurrentState,
    });
    if (!write.result.ok) {
      if (write.result.outcome === "conflict") this.refreshCanonical();
      return this.remember(write.result);
    }

    this.state = candidate;
    this.canonicalRaw = write.canonicalRaw ?? null;
    this.notify();
    return this.remember(write.result);
  }

  private remember(result: StateOperationResult): StateOperationResult {
    this.lastResult = result;
    return result;
  }

  private refreshCanonical(): void {
    const read = readLocalState(CONVERSATION_STATE_STORAGE_KEY);
    const current = normalizeCurrentState(parseLocalState(read.value));
    if (current) {
      this.state = current;
      this.canonicalRaw = read.value;
      this.notify();
    }
  }

  private handleStorageEvent(event: StorageEvent): void {
    if (event.key !== CONVERSATION_STATE_STORAGE_KEY || !event.newValue) return;
    const incoming = normalizeCurrentState(parseLocalState(event.newValue));
    if (!incoming) return;
    const newer =
      incoming.revision > this.state.revision ||
      (incoming.revision === this.state.revision &&
        `${incoming.updatedAt}:${incoming.writerId}` >
          `${this.state.updatedAt}:${this.state.writerId}`);
    if (!newer) return;
    this.state = incoming;
    this.canonicalRaw = event.newValue;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  getSnapshot(): ConversationRepositorySnapshot {
    return cloneSnapshot(this.state);
  }

  listConversations(options: { includeArchived?: boolean } = {}): Conversation[] {
    return this.state.conversations
      .filter(
        (conversation) =>
          conversation.status === "active" ||
          (options.includeArchived && conversation.status === "archived"),
      )
      .map(cloneConversation);
  }

  getConversation(conversationId: string): Conversation | null {
    const conversation = this.state.conversations.find(
      (candidate) =>
        candidate.conversationId === conversationId &&
        candidate.status !== "deleted",
    );
    return conversation ? cloneConversation(conversation) : null;
  }

  getActiveConversation(projectId?: string | null): Conversation | null {
    const active = this.state.activeConversationId
      ? this.state.conversations.find(
          (conversation) =>
            conversation.conversationId === this.state.activeConversationId &&
            conversation.status === "active",
        )
      : undefined;
    if (
      active &&
      (projectId === undefined || (active.projectId ?? null) === projectId)
    ) {
      return cloneConversation(active);
    }

    const fallback = selectFallbackConversation(this.state.conversations, projectId);
    return fallback ? cloneConversation(fallback) : null;
  }

  createConversation(input: CreateConversationInput = {}): ConversationWriteResult {
    const now = this.now();
    const conversationId =
      input.conversationId?.trim() || `conversation-${this.idFactory()}`;
    if (this.state.conversations.some((item) => item.conversationId === conversationId)) {
      return {
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
        persisted: false,
        created: false,
      };
    }

    const conversation: Conversation = {
      conversationId,
      ...(input.projectId?.trim() ? { projectId: input.projectId.trim() } : {}),
      ...(input.goalId?.trim() ? { goalId: input.goalId.trim() } : {}),
      ...(input.missionId?.trim() ? { missionId: input.missionId.trim() } : {}),
      title: input.title?.trim() || "General conversation",
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      revision: 1,
      messages: [],
    };
    const result = this.commit({
      ...this.state,
      activeConversationId: conversationId,
      conversations: [...this.state.conversations, conversation],
    });
    return {
      ...result,
      ...(result.ok ? { conversation: cloneConversation(conversation) } : {}),
      persisted: result.ok,
      created: result.ok,
    };
  }

  setActiveConversation(conversationId: string): StateOperationResult {
    if (this.blockedByFutureVersion) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_UNSUPPORTED_VERSION",
      });
    }
    const conversation = this.state.conversations.find(
      (candidate) =>
        candidate.conversationId === conversationId &&
        candidate.status === "active",
    );
    if (!conversation) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      });
    }
    if (this.state.activeConversationId === conversationId) {
      return this.remember({
        ok: true,
        outcome: "unchanged",
        revision: this.state.revision,
      });
    }

    return this.commit({ ...this.state, activeConversationId: conversationId });
  }

  appendMessage(
    conversationId: string,
    input: AppendConversationMessageInput,
    expectedRevision = this.state.revision,
  ): ConversationMessageWriteResult {
    const conversation = this.state.conversations.find(
      (candidate) =>
        candidate.conversationId === conversationId &&
        candidate.status === "active",
    );
    if (!conversation || !input.content.trim()) {
      return {
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
        persisted: false,
      };
    }

    const messageId = input.messageId?.trim() || `message-${this.idFactory()}`;
    const existing = conversation.messages.find(
      (message) => message.messageId === messageId,
    );
    if (existing) {
      return {
        ok: true,
        outcome: "unchanged",
        revision: this.state.revision,
        persisted: true,
        message: cloneMessage(existing),
        conversation: cloneConversation(conversation),
      };
    }

    const now = input.createdAt ?? this.now();
    const message: ConversationMessage = {
      messageId,
      role: input.role,
      content: input.content,
      createdAt: now,
      ...(input.structuredResponse
        ? { structuredResponse: { ...input.structuredResponse, actionTypes: [...input.structuredResponse.actionTypes] } }
        : {}),
      ...(input.verifiedActionReceiptReferences?.length
        ? {
            verifiedActionReceiptReferences: [
              ...new Set(input.verifiedActionReceiptReferences),
            ],
          }
        : {}),
    };
    const updated: Conversation = {
      ...conversation,
      updatedAt: now,
      lastAccessedAt: now,
      revision: conversation.revision + 1,
      messages: [...conversation.messages, message],
    };
    const conversations = this.state.conversations.map((candidate) =>
      candidate.conversationId === conversationId ? updated : candidate,
    );
    const result = this.commit(
      { ...this.state, activeConversationId: conversationId, conversations },
      expectedRevision,
    );
    return {
      ...result,
      ...(result.ok
        ? {
            message: cloneMessage(message),
            conversation: cloneConversation(updated),
          }
        : {}),
      persisted: result.ok,
    };
  }

  updateConversationMetadata(
    conversationId: string,
    update: ConversationMetadataUpdate,
  ): ConversationWriteResult {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return {
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
        persisted: false,
      };
    }
    const now = this.now();
    const updated: Conversation = {
      ...conversation,
      ...(update.title?.trim() ? { title: update.title.trim() } : {}),
      ...(update.goalId === null
        ? { goalId: undefined }
        : update.goalId?.trim()
          ? { goalId: update.goalId.trim() }
          : {}),
      ...(update.missionId === null
        ? { missionId: undefined }
        : update.missionId?.trim()
          ? { missionId: update.missionId.trim() }
          : {}),
      ...(update.summary === null
        ? { summary: undefined }
        : update.summary
          ? { summary: { ...update.summary } }
          : {}),
      ...(update.betaWorkflow === null
        ? { betaWorkflow: undefined }
        : update.betaWorkflow
          ? { betaWorkflow: normalizeBetaWorkflow(update.betaWorkflow) }
          : {}),
      updatedAt: now,
      lastAccessedAt: now,
      revision: conversation.revision + 1,
    };
    const result = this.commit({
      ...this.state,
      conversations: this.state.conversations.map((candidate) =>
        candidate.conversationId === conversationId ? updated : candidate,
      ),
    });
    return {
      ...result,
      ...(result.ok ? { conversation: cloneConversation(updated) } : {}),
      persisted: result.ok,
    };
  }

  associateWithProject(
    conversationId: string,
    projectId: string | null,
  ): ConversationWriteResult {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return {
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
        persisted: false,
      };
    }
    const now = this.now();
    const updated: Conversation = {
      ...conversation,
      projectId: projectId?.trim() || undefined,
      updatedAt: now,
      lastAccessedAt: now,
      revision: conversation.revision + 1,
    };
    const result = this.commit({
      ...this.state,
      conversations: this.state.conversations.map((candidate) =>
        candidate.conversationId === conversationId ? updated : candidate,
      ),
    });
    return {
      ...result,
      ...(result.ok ? { conversation: cloneConversation(updated) } : {}),
      persisted: result.ok,
    };
  }

  archiveConversation(conversationId: string): StateOperationResult {
    const conversation = this.getConversation(conversationId);
    if (!conversation || conversation.status !== "active") {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      });
    }
    const now = this.now();
    const archived: Conversation = {
      ...conversation,
      status: "archived",
      updatedAt: now,
      revision: conversation.revision + 1,
    };
    const conversations = this.state.conversations.map((candidate) =>
      candidate.conversationId === conversationId ? archived : candidate,
    );
    const fallback = selectFallbackConversation(conversations);
    return this.commit({
      ...this.state,
      activeConversationId:
        this.state.activeConversationId === conversationId
          ? fallback?.conversationId ?? null
          : this.state.activeConversationId,
      conversations,
    });
  }

  deleteConversation(conversationId: string): StateOperationResult {
    const conversation = this.state.conversations.find(
      (candidate) =>
        candidate.conversationId === conversationId &&
        candidate.status !== "deleted",
    );
    if (!conversation) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      });
    }
    const now = this.now();
    const deleted: Conversation = {
      conversationId: conversation.conversationId,
      ...(conversation.projectId ? { projectId: conversation.projectId } : {}),
      title: "Deleted conversation",
      status: "deleted",
      createdAt: conversation.createdAt,
      updatedAt: now,
      lastAccessedAt: now,
      revision: conversation.revision + 1,
      messages: [],
    };
    const conversations = this.state.conversations.map((candidate) =>
      candidate.conversationId === conversationId ? deleted : candidate,
    );
    const fallback = selectFallbackConversation(conversations);
    return this.commit({
      ...this.state,
      activeConversationId:
        this.state.activeConversationId === conversationId
          ? fallback?.conversationId ?? null
          : this.state.activeConversationId,
      conversations,
    });
  }

  clearAllConversations(): StateOperationResult {
    if (this.blockedByFutureVersion) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_UNSUPPORTED_VERSION",
      });
    }
    if (this.state.conversations.length === 0) {
      return this.remember({
        ok: true,
        outcome: "unchanged",
        revision: this.state.revision,
      });
    }
    return this.commit({
      ...this.state,
      activeConversationId: null,
      conversations: [],
    });
  }

  getWorkingHistory(
    conversationId: string,
    options: WorkingHistoryOptions = {},
  ): ConversationMessage[] {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return [];

    const maxMessages = Math.max(
      0,
      Math.min(options.maxMessages ?? MAX_WORKING_HISTORY_MESSAGES, 100),
    );
    const maxCharacters = Math.max(
      0,
      Math.min(options.maxCharacters ?? MAX_WORKING_HISTORY_CHARACTERS, 100_000),
    );
    const candidates = conversation.messages.filter(
      (message) => message.messageId !== options.excludeMessageId,
    );
    const selected = new Set<string>();
    let selectedCharacters = 0;

    const receiptCandidates = candidates
      .filter((message) => message.verifiedActionReceiptReferences?.length)
      .slice()
      .reverse();
    let receiptCharacters = 0;
    for (const message of receiptCandidates) {
      if (selected.size >= Math.min(maxMessages, MAX_RECEIPT_HISTORY_MESSAGES)) break;
      if (
        receiptCharacters + message.content.length >
          Math.min(maxCharacters, MAX_RECEIPT_HISTORY_CHARACTERS) ||
        selectedCharacters + message.content.length > maxCharacters
      ) {
        continue;
      }
      selected.add(message.messageId);
      receiptCharacters += message.content.length;
      selectedCharacters += message.content.length;
    }

    for (const message of candidates.slice().reverse()) {
      if (selected.size >= maxMessages) break;
      if (selected.has(message.messageId)) continue;
      if (selectedCharacters + message.content.length > maxCharacters) continue;
      selected.add(message.messageId);
      selectedCharacters += message.content.length;
    }

    return candidates
      .filter((message) => selected.has(message.messageId))
      .map(cloneMessage);
  }

  getRevision(): number {
    return this.state.revision;
  }

  getMigrationOutcome(): MigrationOutcome {
    return this.migrationOutcome;
  }

  getLastOperationResult(): StateOperationResult {
    return { ...this.lastResult };
  }

  subscribe(listener: ConversationRepositoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageListener);
    }
    this.listeners.clear();
  }
}

export const conversationRepository = new LocalConversationRepository({
  synchronize: true,
});
