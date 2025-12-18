export type JailbreakScoreboardRow = {
    matchId: string;
    attackerChildId: string;
    defenderChildId: string;
    attackerSeat?: number;
    defenderSeat?: number;
    attackerName?: string | null;
    defenderName?: string | null;
    themeTitle: string;
    cracksCompleted: number;
    attackerScore: number;
    defenderScore: number;
    status?: "active" | "completed" | "paused";
    updatedAt: string; // ISO
};
