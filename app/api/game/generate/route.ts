import { NextRequest, NextResponse } from "next/server";

import { evaluateImageMatch, generateGameImage } from "@/lib/ai";
import { SECTION_ONE_ID } from "@/lib/game/config";
import { PhaseId } from "@/lib/game-types";
import { getCue } from "@/lib/server/cues";
import { getSectionProgress, saveSectionProgress } from "@/lib/server/progress";
import { fetchSectionOneConfig } from "@/lib/server/section-one";
import { requireChildSession } from "@/lib/server/session";
import { uploadGameImageToStorage } from "@/lib/server/storage";

export async function POST(req: NextRequest) {
    let session;
    try {
        session = await requireChildSession(req);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { prompt, sectionId = SECTION_ONE_ID } = await req.json();

    if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (sectionId !== SECTION_ONE_ID) {
        return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }

    const { config } = await fetchSectionOneConfig();
    const progress = await getSectionProgress(session.childId, sectionId);

    if (progress.sectionComplete) {
        return NextResponse.json({ error: "Section already complete" }, { status: 400 });
    }

    const activePhase =
        config.phases[Math.min(progress.currentPhase - 1, config.phases.length - 1)];
    const activeLevel =
        activePhase?.levels[
            Math.min(progress.currentLevel - 1, (activePhase?.levels.length ?? 1) - 1)
        ];

    if (!activePhase || !activeLevel) {
        return NextResponse.json({ error: "No level configured" }, { status: 400 });
    }

    if (activePhase.lockedByCue) {
        const cue = await getCue(activePhase.lockedByCue);
        if (!cue?.active) {
            return NextResponse.json(
                { error: "Phase locked by coach cue" },
                { status: 423 }
            );
        }
    }

    const target = activeLevel.target || progress.lastTarget || "the target";

    const { image } = await generateGameImage(prompt);
    const evaluation = await evaluateImageMatch(image, target);
    const imageUrl = await uploadGameImageToStorage(image, session.childId, sectionId);

    const asPhaseId = (value: number): PhaseId => Math.min(Math.max(value, 1), 3) as PhaseId;

    let nextPhase = progress.currentPhase;
    let nextLevel = progress.currentLevel;
    let phase1Complete = progress.phase1Complete ?? false;
    let phase2Complete = progress.phase2Complete ?? false;
    let phase3Complete = progress.phase3Complete ?? false;
    let sectionComplete: boolean = progress.sectionComplete ?? false;

    if (evaluation.match) {
        const phaseLevels = activePhase.levels.length;
        const isLastLevel = nextLevel >= phaseLevels;
        const isLastPhase = nextPhase >= config.phases.length;

        if (!isLastLevel) {
            nextLevel += 1;
        } else {
            if (nextPhase === 1) phase1Complete = true;
            if (nextPhase === 2) phase2Complete = true;
            if (nextPhase === 3) phase3Complete = true;

            if (isLastPhase) {
                // Stay on the final level/phase and mark section as complete.
                sectionComplete = true;
                nextLevel = phaseLevels;
            } else {
                const candidatePhase = Math.min(nextPhase + 1, config.phases.length as number);
                const candidateConfig = config.phases[candidatePhase - 1];
                if (candidateConfig) {
                    if (candidateConfig.lockedByCue) {
                        const cue = await getCue(candidateConfig.lockedByCue);
                        const unlocked = !!cue?.active;
                        if (unlocked) {
                            nextPhase = asPhaseId(candidatePhase);
                            nextLevel = 1;
                        } else {
                            nextPhase = progress.currentPhase;
                            nextLevel = phaseLevels; // stay on last level until unlocked
                        }
                    } else {
                        nextPhase = asPhaseId(candidatePhase);
                        nextLevel = 1;
                    }
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
        sectionComplete,
        lastPrompt: prompt,
        lastImageUrl: imageUrl,
        lastTarget: target,
        lastMatch: evaluation.match,
        lastFeedback: evaluation.feedback,
    };

    await saveSectionProgress(session.childId, sectionId, updated);

    return NextResponse.json({
        imageUrl,
        evaluation,
        progress: updated,
    });
}
export const runtime = "nodejs";
