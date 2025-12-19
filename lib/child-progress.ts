"use client";
import { SectionProgress } from "./game-types";

const SECTION_DEFAULT: Omit<SectionProgress, "updatedAt"> = {
    sectionId: "section-1",
    currentPhase: 1,
    currentLevel: 1,
    phase1Complete: false,
    phase2Complete: false,
    phase3Complete: false,
    sectionComplete: false,
    lastPrompt: "",
    lastImageUrl: "",
    lastTarget: "",
    lastMatch: false,
    lastFeedback: "",
    cuesConsumed: {},
};

function coerceSectionId(sectionId: string) {
    // Preserve backwards-compatible default but allow future sections.
    return { ...SECTION_DEFAULT, sectionId };
}

export function getDefaultSectionProgress(sectionId: string): SectionProgress {
    return {
        ...coerceSectionId(sectionId),
        updatedAt: new Date(),
    };
}

export async function saveChildSectionProgress(
    childId: string,
    sectionId: string,
    changes: Partial<SectionProgress>
) {
    const payload: Partial<SectionProgress> = {
        ...coerceSectionId(sectionId),
        ...changes,
    };

    const res = await fetch(
        `/api/admin/children/${encodeURIComponent(childId)}/progress/${encodeURIComponent(
            sectionId
        )}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to save progress");
    }
}
