import { NextResponse } from "next/server";

import { buildAgentScoreboard } from "@/lib/server/agent-scoreboard";

export async function GET() {
    try {
        const data = await buildAgentScoreboard();
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to build agent scoreboard" },
            { status: 500 }
        );
    }
}

export const runtime = "nodejs";
