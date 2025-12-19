import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { GardenLevel } from "@/lib/garden-types";
import { connectToDatabase } from "@/lib/mongodb";
import { GardenLevelModel, IGardenLevel } from "@/lib/models/garden-level";

export async function GET() {
    await connectToDatabase();
    const docs = await GardenLevelModel.find({}).sort({ levelNumber: 1 }).lean<IGardenLevel[]>();
    const levels = docs.map((doc) => {
        const { _id, ...rest } = doc as IGardenLevel & { _id?: string };
        const id = rest.id ?? _id ?? "";
        return { ...(rest as unknown as GardenLevel), id };
    });

    return NextResponse.json({ levels });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const phaseId = String(body.phaseId ?? "").trim();
        const levelNumber = Number(body.levelNumber);
        const target = String(body.target ?? "").trim();
        const blocks = Array.isArray(body.blocks) ? body.blocks.filter(Boolean) : [];
        const bonusBlocks = Array.isArray(body.bonusBlocks)
            ? body.bonusBlocks.filter(Boolean)
            : [];
        const hint = body.hint ?? "";

        if (!phaseId || !Number.isFinite(levelNumber) || !target) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const id = randomUUID();
        await connectToDatabase();
        await GardenLevelModel.create({
            _id: id,
            id,
            phaseId,
            levelNumber,
            target,
            blocks,
            bonusBlocks,
            hint,
        });

        return NextResponse.json({ id }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create level";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
