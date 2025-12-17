import { Timestamp } from "firebase/firestore";

export type PhaseId = 1 | 2 | 3;

export type SectionProgress = {
    sectionId: string;
    currentPhase: PhaseId;
    currentLevel: number;
    phase1Complete?: boolean;
    phase2Complete?: boolean;
    phase3Complete?: boolean;
    lastPrompt?: string;
    lastImageUrl?: string;
    lastTarget?: string;
    lastMatch?: boolean;
    lastFeedback?: string;
    updatedAt: Timestamp;
    cuesConsumed?: Record<string, boolean>;
};

export type GameCue = {
    id: string;
    type: "start-phase-3" | "unlock-blocks" | "note" | string;
    active: boolean;
    payload?: Record<string, unknown>;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};
