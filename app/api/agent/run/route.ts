import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { AgentLevel } from "@/lib/server/agent-types";
import { runLevelEngine } from "@/lib/server/agent-engine";
import { listAgentStages, listAgentLevelsByStage, recordAgentRun, updateBestForLevel } from "@/lib/server/agent-store";
import { getAgentProgress, saveAgentProgress } from "@/lib/server/agent-progress";
import { listActiveCues } from "@/lib/server/cues";
import { requireChildSession } from "@/lib/server/session";

function orderLevels(levels: AgentLevel[]) {
    return [...levels].sort((a, b) => a.order - b.order);
}

async function ensureUnlocked(
    level: AgentLevel,
    stages: Awaited<ReturnType<typeof listAgentStages>>,
    cues: Awaited<ReturnType<typeof listActiveCues>>,
    currentWaiting?: string | null
): Promise<{ unlocked: boolean; waitingCueType?: string | null }> {
    const stage = stages.find((s) => s.stageType === level.stageType);
    if (!stage?.requiresCueToUnlock) return { unlocked: true };
    const active = cues.some((c) => c.id === stage.unlockCueType || c.type === stage.unlockCueType);
    if (active) return { unlocked: true };
    return { unlocked: false, waitingCueType: stage.unlockCueType ?? currentWaiting ?? null };
}

export async function POST(req: NextRequest) {
    let session;
    try {
        session = await requireChildSession(req);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, levelId } = await req.json();
    if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const stages = await listAgentStages({ activeOnly: true });
    const levelSets = await Promise.all(
        stages.map((s) => listAgentLevelsByStage(s.stageType, { activeOnly: true }))
    );
    const levels = orderLevels(levelSets.flat());

    if (!levels.length) {
        return NextResponse.json({ error: "No levels configured" }, { status: 400 });
    }

    const progress = await getAgentProgress(session.childId);
    const cues = await listActiveCues();

    // If waiting for cue, gate unless cue now active
    if (progress.waitingCueType) {
        const unlockedNow = cues.some(
            (c) => c.id === progress.waitingCueType || c.type === progress.waitingCueType
        );
        if (!unlockedNow) {
            return NextResponse.json(
                { waitingCue: progress.waitingCueType, message: "Waiting for instructor cue" },
                { status: 409 }
            );
        }
    }

    const level =
        (levelId && levels.find((l) => l.id === levelId)) ||
        levels.find((l) => l.order === progress.currentLevelOrder) ||
        levels[0];

    if (!level) {
        return NextResponse.json({ error: "Level not found" }, { status: 400 });
    }

    const unlockCheck = await ensureUnlocked(level, stages, cues, progress.waitingCueType);
    if (!unlockCheck.unlocked) {
        await saveAgentProgress(session.childId, { waitingCueType: unlockCheck.waitingCueType });
        return NextResponse.json(
            { waitingCue: unlockCheck.waitingCueType, message: "Stage locked; awaiting cue" },
            { status: 409 }
        );
    }

    const engine = await runLevelEngine({ level, prompt });

    const runId = await recordAgentRun({
        childId: session.childId,
        levelId: level.id,
        stageType: level.stageType,
        startedAt: Timestamp.now(), // recordAgentRun will set server timestamps
        finishedAt: undefined,
        passed: engine.passed,
        finalAnswer: engine.finalAnswer,
        finalAnswerJson: engine.finalAnswerJson as Record<string, unknown> | null | undefined,
        usage: engine.usage,
        steps: engine.events.length,
        toolCallsCount: engine.events.filter((e) => e.type === "tool_call").length,
        failureReason: engine.failureReason,
    });

    if (engine.passed) {
        await updateBestForLevel(level.id, session.childId);
    }

    // Progression
    let waitingCueType: string | null = null;
    let nextOrder = level.order;
    if (level.requiresCueAfterPass && engine.passed) {
        waitingCueType = level.postPassCueType ?? "pause-after-hallucination";
    } else if (engine.passed || level.stageType === "HALLUCINATION") {
        const remaining = levels.find((l) => l.order > level.order);
        if (remaining) {
            nextOrder = remaining.order;
            // If next stage requires cue, set waiting
            const nextStage = stages.find((s) => s.stageType === remaining.stageType);
            if (nextStage?.requiresCueToUnlock) {
                waitingCueType = nextStage.unlockCueType ?? null;
            }
        }
    }

    await saveAgentProgress(session.childId, {
        currentLevelOrder: nextOrder,
        waitingCueType: waitingCueType ?? null,
    });

    return NextResponse.json({
        runId,
        events: engine.events,
        finalAnswer: engine.finalAnswer,
        finalAnswerJson: engine.finalAnswerJson,
        passed: engine.passed,
        failureReason: engine.failureReason,
        usage: engine.usage,
        nextLevelOrder: nextOrder,
        waitingCueType,
    });
}

export const runtime = "nodejs";
