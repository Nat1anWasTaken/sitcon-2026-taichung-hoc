import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminFirestore } from "../firebase-admin";

export type AgentProgress = {
    childId: string;
    currentLevelOrder: number;
    waitingCueType?: string | null;
    updatedAt: Timestamp;
};

const DEFAULT_PROGRESS: AgentProgress = {
    childId: "",
    currentLevelOrder: 1,
    waitingCueType: null,
    updatedAt: Timestamp.now(),
};

function assertDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

export async function getAgentProgress(childId: string): Promise<AgentProgress> {
    const db = assertDb();
    const ref = db.collection("childAgentProgress").doc(childId);
    const snap = await ref.get();
    if (!snap.exists) {
        const seed: AgentProgress = { ...DEFAULT_PROGRESS, childId, updatedAt: Timestamp.now() };
        await ref.set(seed);
        return seed;
    }
    const data = snap.data() as AgentProgress;
    return {
        ...DEFAULT_PROGRESS,
        ...data,
        childId,
    };
}

export async function saveAgentProgress(childId: string, data: Partial<AgentProgress>) {
    const db = assertDb();
    const ref = db.collection("childAgentProgress").doc(childId);
    await ref.set(
        {
            childId,
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}
