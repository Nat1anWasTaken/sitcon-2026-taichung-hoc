import { NextResponse } from "next/server";

import { listActiveCues } from "@/lib/server/cues";
import { listAgentStages, listAgentLevelsByStage } from "@/lib/server/agent-store";
import { getAgentProgress } from "@/lib/server/agent-progress";
import { requireChildSession } from "@/lib/server/session";

export async function GET() {
    try {
        const session = await requireChildSession();
        const progress = await getAgentProgress(session.childId);
        const stages = await listAgentStages({ activeOnly: true });
        const levels = (
            await Promise.all(stages.map((s) => listAgentLevelsByStage(s.stageType, { activeOnly: true })))
        )
            .flat()
            .sort((a, b) => a.order - b.order);
        const cues = await listActiveCues();
        return NextResponse.json({ progress, stages, levels, cues });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to load progress" },
            { status: 401 }
        );
    }
}

export const runtime = "nodejs";
