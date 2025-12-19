import { Timestamp } from "firebase-admin/firestore";

import { AgentRun, AgentScoreboardRow } from "../agent-types";
import { adminFirestore } from "../firebase-admin";
import { ChildAccount } from "@/lib/types";

function assertDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

export async function buildAgentScoreboard() {
    const db = assertDb();
    const runsSnap = await db.collection("agentRuns").where("passed", "==", true).get();
    const childrenSnap = await db.collection("children").get();
    const childMap = new Map(childrenSnap.docs.map((d) => [d.id, d.data() as ChildAccount]));

    const rows: AgentScoreboardRow[] = runsSnap.docs.map((doc) => {
        const data = doc.data() as AgentRun;
        const child = childMap.get(data.childId);
        const totalTokens: number = data.usage?.totalTokens ?? 0;
        const score = Math.floor(1_000_000 / (Math.max(totalTokens, 1) + 1));
        return {
            childId: data.childId,
            seatNumber: child?.seatNumber ?? 0,
            name: child?.name ?? "",
            levelId: data.levelId,
            stageType: data.stageType,
            totalTokens,
            score,
            bestForLevel: data.bestForLevel ?? false,
        };
    });

    rows.sort((a, b) => b.score - a.score || a.totalTokens - b.totalTokens);

    const generatedAt =
        (runsSnap.docs[0]?.createTime as Timestamp | undefined)?.toDate?.()?.toISOString?.() ??
        new Date().toISOString();

    return { generatedAt, rows };
}
