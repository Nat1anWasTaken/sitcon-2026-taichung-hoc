import { Timestamp } from "firebase-admin/firestore";

import { allSections } from "@/lib/game/config";
import { ScoreboardRow, ScoreboardSection, ScoreboardSnapshot } from "@/lib/scoreboard-types";
import { ChildAccount } from "@/lib/types";

import { adminFirestore } from "../firebase-admin";

function assertAdminDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

type ProgressDoc = {
    sectionId?: string;
    currentPhase?: number;
    currentLevel?: number;
    phase1Complete?: boolean;
    phase2Complete?: boolean;
    phase3Complete?: boolean;
    lastPrompt?: string;
    lastImageUrl?: string;
    lastTarget?: string;
    lastMatch?: boolean;
    lastFeedback?: string;
    updatedAt?: Timestamp;
    cuesConsumed?: Record<string, boolean>;
};

function coerceProgress(sectionId: string, data?: ProgressDoc): Required<ProgressDoc> {
    const updatedAt = data?.updatedAt ?? Timestamp.now();
    return {
        sectionId,
        currentPhase: data?.currentPhase ?? 1,
        currentLevel: data?.currentLevel ?? 1,
        phase1Complete: data?.phase1Complete ?? false,
        phase2Complete: data?.phase2Complete ?? false,
        phase3Complete: data?.phase3Complete ?? false,
        lastPrompt: data?.lastPrompt ?? "",
        lastImageUrl: data?.lastImageUrl ?? "",
        lastTarget: data?.lastTarget ?? "",
        lastMatch: data?.lastMatch ?? false,
        lastFeedback: data?.lastFeedback ?? "",
        updatedAt,
        cuesConsumed: data?.cuesConsumed ?? {},
    };
}

export async function buildScoreboardSnapshot(): Promise<ScoreboardSnapshot> {
    const db = assertAdminDb();

    const childrenSnap = await db.collection("children").get();
    const children: (ChildAccount & { docId: string })[] = childrenSnap.docs.map((doc) => {
        const data = doc.data() as ChildAccount;
        return { ...data, docId: doc.id };
    });

    const sections = await Promise.all(
        allSections.map(async (section) => {
            const rows = await Promise.all(
                children.map(async (child) => {
                    const progressSnap = await db
                        .collection("childProgress")
                        .doc(child.docId)
                        .collection("sections")
                        .doc(section.id)
                        .get();

                    const progress = coerceProgress(
                        section.id,
                        progressSnap.data() as ProgressDoc | undefined
                    );
                    const updatedAt =
                        (progress.updatedAt as Timestamp | undefined)
                            ?.toDate?.()
                            ?.toISOString?.() ?? new Date().toISOString();

                    return {
                        childId: child.childId || child.docId,
                        seatNumber: child.seatNumber,
                        name: child.name,
                        status: child.status,
                        currentPhase: progress.currentPhase,
                        currentLevel: progress.currentLevel,
                        phase1Complete: progress.phase1Complete ?? false,
                        phase2Complete: progress.phase2Complete ?? false,
                        phase3Complete: progress.phase3Complete ?? false,
                        updatedAt,
                    } satisfies ScoreboardRow;
                })
            );

            rows.sort((a, b) => a.seatNumber - b.seatNumber);

            return {
                sectionId: section.id,
                title: section.title,
                phases: section.phases.length,
                rows,
            } as ScoreboardSection;
        })
    );

    return {
        generatedAt: new Date().toISOString(),
        sections,
    };
}
