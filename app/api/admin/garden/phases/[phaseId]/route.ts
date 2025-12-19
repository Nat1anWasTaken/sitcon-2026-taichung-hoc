import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { GardenLevelModel } from "@/lib/models/garden-level";
import { GardenPhaseModel } from "@/lib/models/garden-phase";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ phaseId: string }> }
) {
    const { phaseId } = await params;
    if (!phaseId) {
        return NextResponse.json({ error: "phaseId required" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.title !== "undefined") updates.title = body.title;
    if (typeof body.mode !== "undefined") updates.mode = body.mode;
    if (typeof body.order !== "undefined") updates.order = Number(body.order);
    if (typeof body.description !== "undefined") updates.description = body.description;
    if (typeof body.lockedByCue !== "undefined") updates.lockedByCue = body.lockedByCue;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 1) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await GardenPhaseModel.updateOne({ _id: phaseId }, { $set: updates });
    if (!result.matchedCount) {
        return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ phaseId: string }> }
) {
    const { phaseId } = await params;
    if (!phaseId) {
        return NextResponse.json({ error: "phaseId required" }, { status: 400 });
    }

    await connectToDatabase();
    await GardenLevelModel.deleteMany({ phaseId });
    const result = await GardenPhaseModel.deleteOne({ _id: phaseId });
    if (!result.deletedCount) {
        return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
