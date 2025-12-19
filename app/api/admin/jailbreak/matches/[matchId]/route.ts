import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakMatchModel } from "@/lib/models/jailbreak-match";
import { JailbreakTurnModel } from "@/lib/models/jailbreak-turn";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    if (!matchId) {
        return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.status !== "undefined") updates.status = body.status;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 1) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await JailbreakMatchModel.updateOne({ _id: matchId }, { $set: updates });
    if (!result.matchedCount) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    if (!matchId) {
        return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    await connectToDatabase();
    await JailbreakTurnModel.deleteMany({ matchId });
    const result = await JailbreakMatchModel.deleteOne({ _id: matchId });
    if (!result.deletedCount) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
