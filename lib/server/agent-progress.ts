import { connectToDatabase } from "../mongodb";
import { ChildAgentProgressModel, IChildAgentProgress } from "../models/child-agent-progress";

export type AgentProgress = {
    childId: string;
    currentLevelOrder: number;
    waitingCueType?: string | null;
    updatedAt: Date;
};

const DEFAULT_PROGRESS: AgentProgress = {
    childId: "",
    currentLevelOrder: 1,
    waitingCueType: null,
    updatedAt: new Date(),
};

export async function getAgentProgress(childId: string): Promise<AgentProgress> {
    await connectToDatabase();
    const doc = await ChildAgentProgressModel.findOneAndUpdate(
        { _id: childId },
        {
            $setOnInsert: {
                currentLevelOrder: DEFAULT_PROGRESS.currentLevelOrder,
                waitingCueType: null,
            },
        },
        { upsert: true, new: true }
    ).lean<IChildAgentProgress>();
    return {
        childId,
        currentLevelOrder: doc!.currentLevelOrder ?? DEFAULT_PROGRESS.currentLevelOrder,
        waitingCueType: doc!.waitingCueType ?? null,
        updatedAt: doc!.updatedAt ?? new Date(),
    };
}

export async function saveAgentProgress(childId: string, data: Partial<AgentProgress>) {
    await connectToDatabase();
    const updates: Record<string, unknown> = {
        updatedAt: new Date(),
    };
    Object.entries(data).forEach(([key, value]) => {
        if (key === "updatedAt" || typeof value === "undefined") return;
        updates[key] = value;
    });
    await ChildAgentProgressModel.updateOne(
        { _id: childId },
        {
            $set: updates,
            $setOnInsert: {
                _id: childId,
                currentLevelOrder: DEFAULT_PROGRESS.currentLevelOrder,
                waitingCueType: null,
            },
        },
        { upsert: true }
    );
}
