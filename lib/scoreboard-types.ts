import { ChildAccount } from "@/lib/types";

export type ScoreboardRow = {
    childId: string;
    seatNumber: number;
    name?: string | null;
    status?: ChildAccount["status"];
    currentPhase: number;
    currentLevel: number;
    phase1Complete: boolean;
    phase2Complete: boolean;
    phase3Complete: boolean;
    sectionComplete?: boolean;
    updatedAt: string; // ISO string
};

export type ScoreboardSection = {
    sectionId: string;
    title: string;
    phases: number;
    rows: ScoreboardRow[];
};

export type ScoreboardSnapshot = {
    generatedAt: string;
    sections: ScoreboardSection[];
};
