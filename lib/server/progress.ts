import { connectToDatabase } from "../mongodb";
import { ChildProgressModel, IChildProgress, ISectionProgress } from "../models/child-progress";
import { SectionProgress } from "../game-types";

const SECTION_DEFAULT: Omit<ISectionProgress, "updatedAt"> = {
    sectionId: "section-1",
    currentPhase: 1,
    currentLevel: 1,
    phase1Complete: false,
    phase2Complete: false,
    phase3Complete: false,
    sectionComplete: false,
    lastPrompt: "",
    lastImageUrl: "",
    lastTarget: "",
    lastMatch: false,
    lastFeedback: "",
    cuesConsumed: {},
};

function getSection(
    progress: IChildProgress | null,
    sectionId: string
): ISectionProgress | undefined {
    if (!progress?.sections) return undefined;
    if (progress.sections instanceof Map) {
        return progress.sections.get(sectionId);
    }
    const sections = progress.sections as unknown as Record<string, ISectionProgress>;
    return sections[sectionId];
}

function buildSection(sectionId: string, data?: Partial<ISectionProgress>): ISectionProgress {
    return {
        ...SECTION_DEFAULT,
        ...data,
        sectionId,
        updatedAt: data?.updatedAt ?? new Date(),
    };
}

export async function getSectionProgress(
    childId: string,
    sectionId: string
): Promise<SectionProgress> {
    await connectToDatabase();
    const progress = await ChildProgressModel.findById(childId).lean<IChildProgress | null>();
    const section = getSection(progress, sectionId);
    if (!section) {
        const seed = buildSection(sectionId);
        await ChildProgressModel.updateOne(
            { _id: childId },
            {
                $set: { [`sections.${sectionId}`]: seed },
                $setOnInsert: { _id: childId },
            },
            { upsert: true }
        );
        return seed as unknown as SectionProgress;
    }
    return buildSection(sectionId, section) as unknown as SectionProgress;
}

export async function saveSectionProgress(
    childId: string,
    sectionId: string,
    data: Partial<SectionProgress>
) {
    await connectToDatabase();
    const updates: Record<string, unknown> = {
        [`sections.${sectionId}.sectionId`]: sectionId,
        [`sections.${sectionId}.updatedAt`]: new Date(),
    };
    Object.entries(data as Partial<ISectionProgress>).forEach(([key, value]) => {
        if (key === "updatedAt" || typeof value === "undefined") return;
        updates[`sections.${sectionId}.${key}`] = value;
    });
    await ChildProgressModel.updateOne(
        { _id: childId },
        {
            $set: updates,
            $setOnInsert: { _id: childId },
        },
        { upsert: true }
    );
}
