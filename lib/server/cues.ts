import { FieldValue } from "firebase-admin/firestore";

import { adminFirestore } from "../firebase-admin";
import { GameCue } from "../game-types";

function assertAdminDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

const CUES_COLLECTION = "gameCues";

export async function listActiveCues(): Promise<GameCue[]> {
    const db = assertAdminDb();
    const snap = await db.collection(CUES_COLLECTION).where("active", "==", true).get();
    return snap.docs.map((d) => {
        const { id: _ignored, ...rest } = d.data() as GameCue;
        return { ...rest, id: d.id };
    });
}

export async function setCueState(cueId: string, data: Partial<GameCue>) {
    const db = assertAdminDb();
    const { id: _ignored, ...safeData } = data;
    await db
        .collection(CUES_COLLECTION)
        .doc(cueId)
        .set(
            {
                active: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                ...safeData,
                id: cueId,
            },
            { merge: true }
        );
}

export async function getCue(cueId: string): Promise<GameCue | null> {
    const db = assertAdminDb();
    const snap = await db.collection(CUES_COLLECTION).doc(cueId).get();
    if (!snap.exists) return null;
    const { id: _ignored, ...rest } = snap.data() as GameCue;
    return { ...rest, id: snap.id };
}
