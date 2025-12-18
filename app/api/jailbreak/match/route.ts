import { NextRequest, NextResponse } from "next/server";

import {
    loadMatchViewForChild,
    requireSectionOneComplete,
    requireSectionTwoCue,
} from "@/lib/server/jailbreak";
import { requireChildSession } from "@/lib/server/session";

export async function GET(req: NextRequest) {
    try {
        const session = await requireChildSession(req);
        await requireSectionTwoCue();
        await requireSectionOneComplete(session.childId);
        const match = await loadMatchViewForChild(session.childId);
        if (!match) {
            return NextResponse.json({ error: "No match assigned" }, { status: 404 });
        }
        return NextResponse.json({ match });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load match";
        const status =
            message.startsWith("Section 2") || message.startsWith("Complete Section 1") ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}

export const runtime = "nodejs";
