import { Timestamp } from "firebase-admin/firestore";

import { JailbreakScoreboardRow } from "../jailbreak-scoreboard-types";
import { adminFirestore } from "../firebase-admin";

function assertDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

export async function buildJailbreakScoreboard(): Promise<{
    generatedAt: string;
    rows: JailbreakScoreboardRow[];
}> {
    const db = assertDb();

    const [matchesSnap, childrenSnap] = await Promise.all([
        db.collection("jailbreakMatches").orderBy("updatedAt", "desc").limit(50).get(),
        db.collection("children").get(),
    ]);

    const childMap = new Map(childrenSnap.docs.map((d) => [d.id, d.data() as any]));

    const rows: JailbreakScoreboardRow[] = matchesSnap.docs.map((doc) => {
        const data = doc.data() as any;
        const attacker = childMap.get(data.attackerChildId) as any;
        const defender = childMap.get(data.defenderChildId) as any;
        const updatedAt = (data.updatedAt as Timestamp | undefined)?.toDate?.()?.toISOString?.();

        return {
            matchId: doc.id,
            attackerChildId: data.attackerChildId,
            defenderChildId: data.defenderChildId,
            attackerSeat: attacker?.seatNumber ?? data.attackerSeat,
            defenderSeat: defender?.seatNumber ?? data.defenderSeat,
            attackerName: attacker?.name ?? data.attackerName ?? null,
            defenderName: defender?.name ?? data.defenderName ?? null,
            themeTitle: data.themeTitle,
            cracksCompleted: data.cracksCompleted ?? 0,
            attackerScore: data.attackerScore ?? 0,
            defenderScore: data.defenderScore ?? 0,
            status: data.status,
            updatedAt: updatedAt ?? new Date().toISOString(),
        } satisfies JailbreakScoreboardRow;
    });

    rows.sort((a, b) => b.attackerScore - a.attackerScore || (b.updatedAt > a.updatedAt ? 1 : -1));

    const generatedAt =
        (matchesSnap.docs[0]?.updateTime as Timestamp | undefined)?.toDate?.()?.toISOString?.() ??
        new Date().toISOString();

    return { generatedAt, rows };
}
