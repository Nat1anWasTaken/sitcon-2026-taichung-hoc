export type JailbreakDifficulty = "easy" | "medium" | "hard";

export type JailbreakTheme = {
    id: string;
    title: string;
    description: string;
    difficulty: JailbreakDifficulty;
    adminPrompt: string;
    breachCriteria: string;
    createdAt: Date | string;
    updatedAt: Date | string;
};

export type MatchPhase = "ATTACK_PHASE" | "DEFENDER_PATCH" | "COMPLETED";

export type JailbreakMatch = {
    id: string;
    attackerChildId: string;
    defenderChildId: string;
    attackerSeat?: number;
    defenderSeat?: number;
    attackerName?: string | null;
    defenderName?: string | null;
    themeId: string;
    themeTitle: string;
    themeDescription: string;
    adminPrompt: string;
    breachCriteria: string;
    developerPrompt: string;
    cracksCompleted: number;
    attackerScore: number;
    defenderScore: number;
    currentPhase: MatchPhase;
    attemptCount: number;
    status?: "active" | "completed" | "paused";
    /**
     * Server-assigned deadline for the active phase. Turn expires after this timestamp.
     */
    phaseExpiresAt?: Date | string;
    /**
     * Array of theme IDs that have been completed (3 cracks) in this match.
     */
    completedThemeIds?: string[];
    createdAt: Date | string;
    updatedAt: Date | string;
};

export type JailbreakTurn = {
    id: string;
    matchId: string;
    attackerPrompt: string;
    aiResponse: string;
    breach: boolean;
    refereeReason?: string;
    tokensUsed?: number;
    createdAt: Date | string;
};

export type PublicMatchView = {
    matchId: string;
    role: "attacker" | "defender";
    themeTitle: string;
    themeDescription: string;
    cracksCompleted: number;
    currentPhase: MatchPhase;
    attackerScore: number;
    defenderScore: number;
    status?: JailbreakMatch["status"];
    developerPrompt?: string;
    breachCriteria?: string;
    logs: Array<{
        id: string;
        attackerPrompt: string;
        aiResponse: string;
        breach: boolean;
        refereeReason?: string;
        tokensUsed?: number;
        createdAt: string; // ISO string; serialized for client safety
    }>;
    /**
     * Deadline for the current phase in ISO string form; undefined when match is completed.
     */
    phaseExpiresAt?: string;
    /**
     * Number of themes completed in this match.
     */
    themesCompleted?: number;
    /**
     * Total number of themes available for this match.
     */
    totalThemes?: number;
};
