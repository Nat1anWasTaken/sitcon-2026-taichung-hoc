import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakMatchModel, IJailbreakMatch } from "@/lib/models/jailbreak-match";

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    if (!matchId) {
        return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    await connectToDatabase();
    const match = await JailbreakMatchModel.findById(matchId).lean<IJailbreakMatch | null>();
    if (!match) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    await JailbreakMatchModel.updateOne(
        { _id: matchId },
        {
            $set: {
                attackerChildId: match.defenderChildId,
                defenderChildId: match.attackerChildId,
                attackerSeat: match.defenderSeat,
                defenderSeat: match.attackerSeat,
                attackerName: match.defenderName,
                defenderName: match.attackerName,
                attackerScore: match.defenderScore,
                defenderScore: match.attackerScore,
                updatedAt: new Date(),
            },
        }
    );

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
