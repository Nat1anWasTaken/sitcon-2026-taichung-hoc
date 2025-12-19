import { NextResponse } from "next/server";

import { GameCue } from "@/lib/game-types";
import { connectToDatabase } from "@/lib/mongodb";
import { GameCueModel, IGameCue } from "@/lib/models/game-cue";

export async function GET() {
    await connectToDatabase();
    const docs = await GameCueModel.find({}).sort({ updatedAt: -1 }).lean<IGameCue[]>();
    const cues = docs.map((doc) => {
        const { _id, ...rest } = doc as IGameCue & { _id?: string };
        const id = rest.id ?? _id ?? "";
        return { ...(rest as unknown as GameCue), id };
    });

    return NextResponse.json({ cues });
}

export const runtime = "nodejs";
