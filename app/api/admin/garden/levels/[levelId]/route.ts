import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { GardenLevelModel } from "@/lib/models/garden-level";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ levelId: string }> }
) {
    const { levelId } = await params;
    if (!levelId) {
        return NextResponse.json({ error: "levelId required" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (typeof body.phaseId !== "undefined") updates.phaseId = body.phaseId;
    if (typeof body.levelNumber !== "undefined")
        updates.levelNumber = Number(body.levelNumber);
    if (typeof body.target !== "undefined") updates.target = body.target;
    if (typeof body.blocks !== "undefined") {
        updates.blocks = Array.isArray(body.blocks) ? body.blocks.filter(Boolean) : [];
    }
    if (typeof body.bonusBlocks !== "undefined") {
        updates.bonusBlocks = Array.isArray(body.bonusBlocks) ? body.bonusBlocks.filter(Boolean) : [];
    }
    if (typeof body.hint !== "undefined") updates.hint = body.hint;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 1) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await GardenLevelModel.updateOne({ _id: levelId }, { $set: updates });
    if (!result.matchedCount) {
        return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ levelId: string }> }
) {
    const { levelId } = await params;
    if (!levelId) {
        return NextResponse.json({ error: "levelId required" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await GardenLevelModel.deleteOne({ _id: levelId });
    if (!result.deletedCount) {
        return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
