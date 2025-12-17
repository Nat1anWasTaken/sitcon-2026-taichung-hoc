import { NextRequest, NextResponse } from "next/server";

import { evaluateImageMatch, generateGameImage } from "@/lib/ai";
import { getSectionConfig } from "@/lib/game/config";
import { getSectionProgress, saveSectionProgress } from "@/lib/server/progress";
import { getCue } from "@/lib/server/cues";
import { requireChildSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
    let session;
    try {
        session = requireChildSession(req);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { prompt, sectionId = "section-1" } = await req.json();

    if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const config = getSectionConfig(sectionId);
    const progress = await getSectionProgress(session.childId, sectionId);

    const activePhase = config.phases[progress.currentPhase - 1];
    const activeLevel = activePhase.levels[progress.currentLevel - 1];
    const target = activeLevel?.target ?? progress.lastTarget ?? "the target";

    const { image, dataUrl } = await generateGameImage(prompt);
    const evaluation = await evaluateImageMatch(image, target);

    let nextPhase = progress.currentPhase;
    let nextLevel = progress.currentLevel;
    let phase1Complete = progress.phase1Complete ?? false;
    let phase2Complete = progress.phase2Complete ?? false;
    let phase3Complete = progress.phase3Complete ?? false;

    if (evaluation.match) {
        const phaseLevels = activePhase.levels.length;
        const isLastLevel = nextLevel >= phaseLevels;

        if (!isLastLevel) {
            nextLevel += 1;
        } else {
            if (nextPhase === 1) phase1Complete = true;
            if (nextPhase === 2) phase2Complete = true;
            if (nextPhase === 3) phase3Complete = true;

            const candidatePhase = Math.min(nextPhase + 1, config.phases.length as number);
            const candidateConfig = config.phases[candidatePhase - 1];
            if (candidateConfig) {
                if (candidateConfig.lockedByCue) {
                    const cue = await getCue(candidateConfig.lockedByCue);
                    const unlocked = !!cue?.active;
                    if (unlocked) {
                        nextPhase = candidatePhase;
                        nextLevel = 1;
                    } else {
                        nextPhase = progress.currentPhase;
                        nextLevel = phaseLevels; // stay on last level until unlocked
                    }
                } else {
                    nextPhase = candidatePhase;
                    nextLevel = 1;
                }
            }
        }
    }

    const updated = {
        sectionId,
        currentPhase: nextPhase,
        currentLevel: nextLevel,
        phase1Complete,
        phase2Complete,
        phase3Complete,
        lastPrompt: prompt,
        lastImageUrl: dataUrl,
        lastTarget: target,
        lastMatch: evaluation.match,
        lastFeedback: evaluation.feedback,
    };

    await saveSectionProgress(session.childId, sectionId, updated);

    return NextResponse.json({
        imageUrl: dataUrl,
        evaluation,
        progress: updated,
    });
}
export const runtime = "nodejs";
