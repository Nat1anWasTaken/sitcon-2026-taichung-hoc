import { NextRequest, NextResponse } from "next/server";

import { recordAttackAttempt, requireSectionTwoCue } from "@/lib/server/jailbreak";
import { requireChildSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
    let session;
    try {
        session = await requireChildSession(req);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { prompt, matchId } = await req.json();
        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        await requireSectionTwoCue();
        const match = await recordAttackAttempt({
            childId: session.childId,
            matchId,
            attackerPrompt: prompt,
        });

        return NextResponse.json({ match });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Attack failed";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export const runtime = "nodejs";
