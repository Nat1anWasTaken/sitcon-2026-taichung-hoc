import { connectToDatabase } from "../mongodb";
import { GameCueModel, IGameCue } from "../models/game-cue";
import { GameCue } from "../game-types";

export async function listActiveCues(): Promise<GameCue[]> {
    await connectToDatabase();
    const cues = await GameCueModel.find({ active: true }).lean<IGameCue[]>();
    return cues.map((cue) => {
        const { _id, ...rest } = cue;
        return { ...rest, id: cue.id ?? _id } as unknown as GameCue;
    });
}

export async function setCueState(cueId: string, data: Partial<GameCue>) {
    const safeData = { ...data } as Partial<GameCue> & Record<string, unknown>;
    delete safeData.id;
    await connectToDatabase();
    const cueType = (safeData.type as string | undefined) ?? cueId;
    const payload = {
        active: safeData.active ?? false,
        type: cueType,
        ...safeData,
        id: cueId,
        updatedAt: new Date(),
    };
    await GameCueModel.updateOne(
        { _id: cueId },
        {
            $set: payload,
            $setOnInsert: {
                _id: cueId,
                createdAt: new Date(),
            },
        },
        { upsert: true }
    );
}

export async function getCue(cueId: string): Promise<GameCue | null> {
    await connectToDatabase();
    const cue = await GameCueModel.findById(cueId).lean<IGameCue | null>();
    if (!cue) return null;
    const { _id, ...rest } = cue;
    return { ...rest, id: cue.id ?? _id } as unknown as GameCue;
}
