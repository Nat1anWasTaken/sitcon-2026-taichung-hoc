import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminFirestore } from "../firebase-admin";
import { SectionProgress } from "../game-types";

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

function assertAdminDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

export function progressRef(childId: string, sectionId: string) {
    const db = assertAdminDb();
    return db.collection("childProgress").doc(childId).collection("sections").doc(sectionId);
}

export async function getSectionProgress(
    childId: string,
    sectionId: string
): Promise<SectionProgress> {
    const ref = progressRef(childId, sectionId);
    const snap = await ref.get();
    if (!snap.exists) {
        const seed = {
            ...SECTION_DEFAULT,
            sectionId,
            updatedAt: Timestamp.now(),
        };
        await ref.set(seed);
        return seed as SectionProgress;
    }
    return snap.data() as SectionProgress;
}

export async function saveSectionProgress(
    childId: string,
    sectionId: string,
    data: Partial<SectionProgress>
) {
    const ref = progressRef(childId, sectionId);
    await ref.set(
        {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}
