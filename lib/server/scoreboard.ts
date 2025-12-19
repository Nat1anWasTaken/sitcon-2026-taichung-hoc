import { allSections } from "@/lib/game/config";
import { ScoreboardRow, ScoreboardSection, ScoreboardSnapshot } from "@/lib/scoreboard-types";

import { connectToDatabase } from "../mongodb";
import { ChildProgressModel, IChildProgress, ISectionProgress } from "../models/child-progress";
import { ChildModel, IChild } from "../models/child";

type ProgressDoc = {
    sectionId?: string;
    currentPhase?: number;
    currentLevel?: number;
    phase1Complete?: boolean;
    phase2Complete?: boolean;
    phase3Complete?: boolean;
    sectionComplete?: boolean;
    lastPrompt?: string;
    lastImageUrl?: string;
    lastTarget?: string;
    lastMatch?: boolean;
    lastFeedback?: string;
    updatedAt?: Date;
    cuesConsumed?: Record<string, boolean>;
};

function coerceProgress(sectionId: string, data?: ProgressDoc): Required<ProgressDoc> {
    const updatedAt = data?.updatedAt ?? new Date();
    return {
        sectionId,
        currentPhase: data?.currentPhase ?? 1,
        currentLevel: data?.currentLevel ?? 1,
        phase1Complete: data?.phase1Complete ?? false,
        phase2Complete: data?.phase2Complete ?? false,
        phase3Complete: data?.phase3Complete ?? false,
        sectionComplete: data?.sectionComplete ?? false,
        lastPrompt: data?.lastPrompt ?? "",
        lastImageUrl: data?.lastImageUrl ?? "",
        lastTarget: data?.lastTarget ?? "",
        lastMatch: data?.lastMatch ?? false,
        lastFeedback: data?.lastFeedback ?? "",
        updatedAt,
        cuesConsumed: data?.cuesConsumed ?? {},
    };
}

function getSection(
    progress: IChildProgress | null,
    sectionId: string
): ISectionProgress | undefined {
    if (!progress?.sections) return undefined;
    if (progress.sections instanceof Map) return progress.sections.get(sectionId);
    const sections = progress.sections as unknown as Record<string, ISectionProgress>;
    return sections[sectionId];
}

export async function buildScoreboardSnapshot(): Promise<ScoreboardSnapshot> {
    await connectToDatabase();

    const children = await ChildModel.find({}).lean<IChild[]>();
    const childIds = children.map((child) => child._id);
    const progressDocs = await ChildProgressModel.find({ _id: { $in: childIds } }).lean<
        IChildProgress[]
    >();
    const progressMap = new Map(progressDocs.map((doc) => [doc._id, doc]));

    const sections = await Promise.all(
        allSections.map(async (section) => {
            const rows = await Promise.all(
                children.map(async (child) => {
                    const progressDoc = progressMap.get(child._id) ?? null;
                    const sectionProgress = getSection(progressDoc, section.id);
                    const progress = coerceProgress(section.id, sectionProgress as ProgressDoc);
                    const updatedAt =
                        progress.updatedAt?.toISOString?.() ?? new Date().toISOString();

                    return {
                        childId: child.childId || child._id,
                        seatNumber: child.seatNumber,
                        name: child.name,
                        status: child.status,
                        currentPhase: progress.currentPhase,
                        currentLevel: progress.currentLevel,
                        phase1Complete: progress.phase1Complete ?? false,
                        phase2Complete: progress.phase2Complete ?? false,
                        phase3Complete: progress.phase3Complete ?? false,
                        sectionComplete: progress.sectionComplete ?? false,
                        updatedAt,
                    } satisfies ScoreboardRow;
                })
            );

            rows.sort((a, b) => a.seatNumber - b.seatNumber);

            return {
                sectionId: section.id,
                title: section.title,
                phases: section.phases.length,
                rows,
            } as ScoreboardSection;
        })
    );

    return {
        generatedAt: new Date().toISOString(),
        sections,
    };
}
