import { NextRequest, NextResponse } from "next/server";

import {
    recordAttackAttempt,
    requireSectionOneComplete,
    requireSectionTwoCue,
} from "@/lib/server/jailbreak";
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
        await requireSectionOneComplete(session.childId);
        const match = await recordAttackAttempt({
            childId: session.childId,
            matchId,
            attackerPrompt: prompt,
        });

        return NextResponse.json({ match });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Attack failed";
        const status = message.startsWith("Section 2") || message.startsWith("Complete Section 1")
            ? 403
            : 400;
        return NextResponse.json({ error: message }, { status });
    }
}

export const runtime = "nodejs";
