import { NextRequest, NextResponse } from "next/server";

import { applyDefenderPatch, requireSectionTwoCue } from "@/lib/server/jailbreak";
import { requireChildSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
    let session;
    try {
        session = await requireChildSession(req);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { developerPrompt, matchId } = await req.json();
        if (!developerPrompt || typeof developerPrompt !== "string") {
            return NextResponse.json({ error: "Developer prompt is required" }, { status: 400 });
        }

        await requireSectionTwoCue();
        const match = await applyDefenderPatch({
            childId: session.childId,
            matchId,
            developerPrompt,
        });
        return NextResponse.json({ match });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Patch failed";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export const runtime = "nodejs";
