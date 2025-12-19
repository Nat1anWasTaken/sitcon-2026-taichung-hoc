export type AgentStageType = "HALLUCINATION" | "TOOLS" | "DEFENSE";

export type AgentStage = {
    id: string;
    stageType: AgentStageType;
    title: string;
    description?: string;
    order: number;
    requiresCueToUnlock?: boolean;
    unlockCueType?: string;
    isActive: boolean;
};

export type JudgeType = "EXACT" | "JSON_SCHEMA" | "REFEREE_LLM";

export type AgentLevelExpected = {
    judgeType: JudgeType;
    canonicalAnswer?: unknown;
    jsonSchema?: unknown;
    refereeCriteria?: string;
};

export type ToolScopeConfig = Record<string, unknown>;

export type AgentLevel = {
    id: string;
    stageType: AgentStageType;
    order: number;
    briefing: string;
    taskPrompt: string;
    allowedTools: string[];
    toolScopes?: Record<string, ToolScopeConfig>;
    expected: AgentLevelExpected;
    maxSteps?: number;
    isActive: boolean;
    teachingNotes?: string;
    requiresCueAfterPass?: boolean;
    postPassCueType?: string;
};

export type KnowledgeSourceTier = "trusted" | "untrusted";

export type AgentKnowledgeDoc = {
    id: string;
    entityKey: string;
    sourceTitle: string;
    sourceTier: KnowledgeSourceTier;
    publishedAt: Date | string;
    supersedesDocId?: string | null;
    content: string;
    facts?: Record<string, unknown> | null;
};

export type AgentRunUsage = {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};

export type AgentRun = {
    id: string;
    childId: string;
    levelId: string;
    stageType: AgentStageType;
    startedAt: Date | string;
    finishedAt?: Date | string;
    passed: boolean;
    finalAnswer?: string;
    finalAnswerJson?: Record<string, unknown> | null;
    usage?: AgentRunUsage;
    steps: number;
    toolCallsCount: number;
    bestForLevel?: boolean;
    failureReason?:
        | "NO_TOOL_USED"
        | "WRONG_FORMAT"
        | "WRONG_ANSWER"
        | "MAX_STEPS"
        | "SCOPE_VIOLATION"
        | "RUNTIME_ERROR"
        | string
        | null;
};

export type AgentScoreboardRow = {
    childId: string;
    seatNumber: number;
    name?: string | null;
    levelId: string;
    stageType: AgentStageType;
    totalTokens: number;
    score: number;
    bestForLevel: boolean;
};
