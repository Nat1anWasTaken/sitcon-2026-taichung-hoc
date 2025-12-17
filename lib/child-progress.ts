"use client";

import {
    DocumentSnapshot,
    Timestamp,
    getDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { sectionProgressDoc } from "./collections";
import { SectionProgress } from "./game-types";

const SECTION_DEFAULT: Omit<SectionProgress, "updatedAt"> = {
    sectionId: "section-1",
    currentPhase: 1,
    currentLevel: 1,
    phase1Complete: false,
    phase2Complete: false,
    phase3Complete: false,
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
        updatedAt: Timestamp.now(),
    };
}

export function mergeSectionProgressSnapshot(
    sectionId: string,
    snap: DocumentSnapshot<SectionProgress> | null
): SectionProgress {
    if (snap && snap.exists()) {
        return {
            ...coerceSectionId(sectionId),
            ...snap.data(),
        };
    }
    return getDefaultSectionProgress(sectionId);
}

export async function saveChildSectionProgress(
    childId: string,
    sectionId: string,
    changes: Partial<SectionProgress>
) {
    const ref = sectionProgressDoc(childId, sectionId);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() : getDefaultSectionProgress(sectionId);

    const payload: Partial<SectionProgress> = {
        ...coerceSectionId(sectionId),
        ...current,
        ...changes,
        updatedAt: serverTimestamp() as SectionProgress["updatedAt"],
    };

    await setDoc(ref, payload, { merge: true });
}
