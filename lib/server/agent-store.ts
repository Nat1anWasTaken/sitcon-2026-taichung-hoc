import { FieldValue, Query, Timestamp } from "firebase-admin/firestore";

import { adminFirestore } from "../firebase-admin";
import { AgentKnowledgeDoc, AgentLevel, AgentRun, AgentStage, AgentStageType } from "./agent-types";

function assertAdminDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

export async function listAgentStages(options?: { activeOnly?: boolean }): Promise<AgentStage[]> {
    const db = assertAdminDb();
    let ref: Query = db.collection("agentStages");
    if (options?.activeOnly) {
        ref = ref.where("isActive", "==", true);
    }
    const snap = await ref.orderBy("order", "asc").get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentStage, "id">) }));
}

export async function listAgentLevelsByStage(
    stageType: AgentStageType,
    options?: { activeOnly?: boolean }
): Promise<AgentLevel[]> {
    const db = assertAdminDb();
    let ref = db.collection("agentLevels").where("stageType", "==", stageType);
    if (options?.activeOnly) {
        ref = ref.where("isActive", "==", true);
    }
    const snap = await ref.orderBy("order", "asc").get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentLevel, "id">) }));
}

export async function getAgentLevel(levelId: string): Promise<AgentLevel | null> {
    const db = assertAdminDb();
    const snap = await db.collection("agentLevels").doc(levelId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<AgentLevel, "id">) };
}

export async function getActiveLevel(levelId: string): Promise<AgentLevel> {
    const level = await getAgentLevel(levelId);
    if (!level || !level.isActive) throw new Error("Level not found or inactive");
    return level;
}

export async function listKnowledgeDocsForEntity(entityKey: string): Promise<AgentKnowledgeDoc[]> {
    const db = assertAdminDb();
    const snap = await db
        .collection("agentKnowledgeDocs")
        .where("entityKey", "==", entityKey)
        .orderBy("publishedAt", "desc")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentKnowledgeDoc, "id">) }));
}

export async function getKnowledgeDoc(docId: string): Promise<AgentKnowledgeDoc | null> {
    const db = assertAdminDb();
    const snap = await db.collection("agentKnowledgeDocs").doc(docId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<AgentKnowledgeDoc, "id">) };
}

export async function recordAgentRun(run: Omit<AgentRun, "id">, runId?: string): Promise<string> {
    const db = assertAdminDb();
    const id = runId ?? db.collection("agentRuns").doc().id;
    await db
        .collection("agentRuns")
        .doc(id)
        .set({
            ...run,
            startedAt: run.startedAt ?? Timestamp.now(),
            finishedAt: run.finishedAt ?? FieldValue.serverTimestamp(),
        });
    return id;
}

export async function updateBestForLevel(levelId: string, childId: string) {
    const db = assertAdminDb();
    const runsSnap = await db
        .collection("agentRuns")
        .where("levelId", "==", levelId)
        .where("childId", "==", childId)
        .where("passed", "==", true)
        .orderBy("usage.totalTokens", "asc")
        .limit(1)
        .get();

    const bestId = runsSnap.docs[0]?.id;
    if (!bestId) return;

    const batch = db.batch();
    runsSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { bestForLevel: doc.id === bestId });
    });
    await batch.commit();
}
