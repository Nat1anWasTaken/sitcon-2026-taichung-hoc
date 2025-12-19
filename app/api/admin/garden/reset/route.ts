import { NextResponse } from "next/server";

import { sectionOneSeedLevels, sectionOneSeedPhases } from "@/lib/game/config";
import { connectToDatabase } from "@/lib/mongodb";
import { GardenLevelModel } from "@/lib/models/garden-level";
import { GardenPhaseModel } from "@/lib/models/garden-phase";

export async function POST() {
    await connectToDatabase();
    await Promise.all([GardenPhaseModel.deleteMany({}), GardenLevelModel.deleteMany({})]);

    const now = new Date();
    const phases = sectionOneSeedPhases.map((phase) => ({
        _id: phase.id,
        id: phase.id,
        title: phase.title,
        mode: phase.mode,
        order: phase.order,
        description: phase.description ?? "",
        lockedByCue: phase.lockedByCue ?? null,
        createdAt: now,
        updatedAt: now,
    }));

    const levels = sectionOneSeedLevels.map((level) => ({
        _id: level.id,
        id: level.id,
        phaseId: level.phaseId,
        levelNumber: level.levelNumber,
        target: level.target,
        blocks: level.blocks ?? [],
        bonusBlocks: level.bonusBlocks ?? [],
        hint: level.hint ?? "",
        createdAt: now,
        updatedAt: now,
    }));

    if (phases.length) await GardenPhaseModel.insertMany(phases);
    if (levels.length) await GardenLevelModel.insertMany(levels);

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
