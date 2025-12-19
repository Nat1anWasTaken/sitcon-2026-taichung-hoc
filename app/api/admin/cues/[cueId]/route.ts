import { NextRequest, NextResponse } from "next/server";

import { setCueState } from "@/lib/server/cues";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ cueId: string }> }
) {
    const { cueId } = await params;
    if (!cueId) {
        return NextResponse.json({ error: "cueId required" }, { status: 400 });
    }

    try {
        const body = await req.json();
        await setCueState(cueId, body);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update cue";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
