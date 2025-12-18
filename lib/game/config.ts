export const SECTION_ONE_ID = "section-1";

export type LevelConfig = {
    id: string;
    target: string;
    blocks?: string[];
    bonusBlocks?: string[];
    hint?: string;
    order?: number;
};

export type PhaseConfig = {
    id: string;
    title: string;
    mode: "blocks" | "text";
    levels: LevelConfig[];
    lockedByCue?: string;
    description?: string;
    order?: number;
};

export type SectionConfig = {
    id: string;
    title: string;
    phases: PhaseConfig[];
};

export type GardenPhaseRecord = {
    id: string;
    title: string;
    mode: PhaseConfig["mode"];
    order: number;
    description?: string;
    lockedByCue?: string | null;
};

export type GardenLevelRecord = {
    id: string;
    phaseId: string;
    levelNumber: number;
    target: string;
    blocks?: string[];
    bonusBlocks?: string[];
    hint?: string;
};

export function buildSectionConfigFromRecords(
    sectionId: string,
    title: string,
    phases: GardenPhaseRecord[],
    levels: GardenLevelRecord[]
): SectionConfig {
    const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

    return {
        id: sectionId,
        title,
        phases: sortedPhases.map((phase) => {
            const phaseLevels = levels
                .filter((level) => level.phaseId === phase.id)
                .sort((a, b) => a.levelNumber - b.levelNumber);

            return {
                id: phase.id,
                title: phase.title,
                mode: phase.mode,
                lockedByCue: phase.lockedByCue ?? undefined,
                description: phase.description,
                order: phase.order,
                levels: phaseLevels.map((level) => ({
                    id: level.id,
                    target: level.target,
                    blocks: level.blocks,
                    bonusBlocks: level.bonusBlocks,
                    hint: level.hint,
                    order: level.levelNumber,
                })),
            } satisfies PhaseConfig;
        }),
    } satisfies SectionConfig;
}

export const sectionOneSeedPhases: GardenPhaseRecord[] = [
    {
        id: "phase-1",
        title: "Prompt Blocks",
        mode: "blocks",
        order: 1,
        description: "Drag the colorful blocks to build a sentence, then generate the picture.",
    },
    {
        id: "phase-2",
        title: "Type Your Prompt",
        mode: "text",
        order: 2,
        description: "No blocks now! Type a clear prompt to match the target image.",
    },
    {
        id: "phase-3",
        title: "Final Quest",
        mode: "text",
        order: 3,
        lockedByCue: "start-phase-3",
        description: "Unlocked by the admin when everyone finishes phases 1 and 2. Create the grand finale image!",
    },
];

export const sectionOneSeedLevels: GardenLevelRecord[] = [
    {
        id: "p1-level-1",
        phaseId: "phase-1",
        levelNumber: 1,
        target: "a pile of bright orange carrots on a plate",
        blocks: [
            "Generate",
            "a",
            "pile of",
            "bright",
            "orange",
            "carrots",
            "on",
            "a",
            "plate",
            "cartoon",
            "style",
        ],
        bonusBlocks: ["detailed", "soft lighting", "pastel", "studio photo"],
    },
    {
        id: "p1-level-2",
        phaseId: "phase-1",
        levelNumber: 2,
        target: "a cute rabbit holding carrots",
        blocks: ["Generate", "a", "cute", "rabbit", "holding", "carrots", "smiling", "cartoon", "style"],
        bonusBlocks: ["cute eyes", "close-up", "vibrant colors", "sharp focus"],
    },
    {
        id: "p1-level-3",
        phaseId: "phase-1",
        levelNumber: 3,
        target: "two rabbits sharing carrots in a garden",
        blocks: [
            "Generate",
            "two",
            "rabbits",
            "sharing",
            "carrots",
            "in",
            "a",
            "garden",
            "sunny",
            "day",
        ],
        bonusBlocks: ["wide angle", "dramatic lighting", "lush greenery", "high detail"],
    },
    {
        id: "p2-level-1",
        phaseId: "phase-2",
        levelNumber: 1,
        target: "a rabbit chef cooking carrot soup in a pot",
    },
    {
        id: "p2-level-2",
        phaseId: "phase-2",
        levelNumber: 2,
        target: "a carrot-shaped rocket ship flying in the night sky",
    },
    {
        id: "p3-level-1",
        phaseId: "phase-3",
        levelNumber: 1,
        target: "a big carrot festival with kids and rabbits celebrating",
    },
];

export const sectionOneSeed: SectionConfig = buildSectionConfigFromRecords(
    SECTION_ONE_ID,
    "Garden Builders",
    sectionOneSeedPhases,
    sectionOneSeedLevels
);
