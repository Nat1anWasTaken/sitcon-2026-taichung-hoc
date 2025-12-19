import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { GardenPhase } from "@/lib/garden-types";
import { connectToDatabase } from "@/lib/mongodb";
import { GardenPhaseModel, IGardenPhase } from "@/lib/models/garden-phase";

export async function GET() {
    await connectToDatabase();
    const docs = await GardenPhaseModel.find({}).sort({ order: 1 }).lean<IGardenPhase[]>();
    const phases = docs.map((doc) => {
        const { _id, ...rest } = doc as IGardenPhase & { _id?: string };
        const id = rest.id ?? _id ?? "";
        return { ...(rest as unknown as GardenPhase), id };
    });

    return NextResponse.json({ phases });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const title = String(body.title ?? "").trim();
        const mode = body.mode as "blocks" | "text";
        const order = Number(body.order);
        const description = body.description ?? "";
        const lockedByCue = body.lockedByCue ?? null;

        if (!title || !mode || !Number.isFinite(order)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const id = randomUUID();
        await connectToDatabase();
        await GardenPhaseModel.create({
            _id: id,
            id,
            title,
            mode,
            order,
            description,
            lockedByCue,
        });

        return NextResponse.json({ id }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create phase";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
