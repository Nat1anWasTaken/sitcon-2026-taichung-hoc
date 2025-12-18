import { FieldValue } from "firebase-admin/firestore";

import {
    generateJailbreakReply,
    judgeJailbreakBreach,
    streamJailbreakReply,
} from "@/lib/ai";
import { adminFirestore } from "../firebase-admin";
import { getCue } from "./cues";
import { getSectionProgress } from "./progress";
import { JailbreakMatch, JailbreakTurn, MatchPhase, PublicMatchView } from "../jailbreak-types";

function assertAdminDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

const START_SECTION_TWO_CUE = "start-section-2";
const SECTION_ONE_ID = "section-1";

export async function requireSectionTwoCue() {
    const cue = await getCue(START_SECTION_TWO_CUE);
    if (!cue?.active) {
        throw new Error("Section 2 is locked. Ask the admin to start it.");
    }
}

export async function requireSectionOneComplete(childId: string) {
    const progress = await getSectionProgress(childId, SECTION_ONE_ID);
    const done = progress.sectionComplete === true || progress.phase3Complete === true;
    if (!done) {
        throw new Error("Complete Section 1 first.");
    }
}

const MATCH_COLLECTION = "jailbreakMatches";

async function getMatchById(matchId: string): Promise<JailbreakMatch | null> {
    const db = assertAdminDb();
    const snap = await db.collection(MATCH_COLLECTION).doc(matchId).get();
    if (!snap.exists) return null;
    const rest = snap.data() as JailbreakMatch;
    return { ...rest, id: snap.id };
}

async function getMatchForChild(childId: string): Promise<JailbreakMatch | null> {
    const db = assertAdminDb();
    const attackerSnap = await db
        .collection(MATCH_COLLECTION)
        .where("attackerChildId", "==", childId)
        .orderBy("updatedAt", "desc")
        .limit(1)
        .get();
    if (!attackerSnap.empty) {
        const doc = attackerSnap.docs[0];
        const rest = doc.data() as JailbreakMatch;
        return { ...rest, id: doc.id };
    }

    const defenderSnap = await db
        .collection(MATCH_COLLECTION)
        .where("defenderChildId", "==", childId)
        .orderBy("updatedAt", "desc")
        .limit(1)
        .get();
    if (!defenderSnap.empty) {
        const doc = defenderSnap.docs[0];
        const rest = doc.data() as JailbreakMatch;
        return { ...rest, id: doc.id };
    }
    return null;
}

async function listTurns(matchId: string, limit = 20): Promise<JailbreakTurn[]> {
    const db = assertAdminDb();
    const snap = await db
        .collection(MATCH_COLLECTION)
        .doc(matchId)
        .collection("turns")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => {
        const rest = d.data() as JailbreakTurn;
        return { ...rest, id: d.id };
    });
}

function sanitizeMatch(
    match: JailbreakMatch,
    turns: JailbreakTurn[],
    childId: string
): PublicMatchView {
    const role = match.attackerChildId === childId ? "attacker" : "defender";
    return {
        matchId: match.id,
        role,
        themeTitle: match.themeTitle,
        themeDescription: match.themeDescription,
        cracksCompleted: match.cracksCompleted,
        currentPhase: match.currentPhase,
        attackerScore: match.attackerScore,
        defenderScore: match.defenderScore,
        status: match.status,
        developerPrompt: role === "defender" ? match.developerPrompt : undefined,
        logs: turns.map((t) => ({
            id: t.id,
            attackerPrompt: t.attackerPrompt,
            aiResponse: t.aiResponse,
            breach: t.breach,
            refereeReason: role === "defender" ? t.refereeReason : undefined,
            tokensUsed: t.tokensUsed,
            createdAt: t.createdAt.toDate().toISOString(),
        })),
    };
}

export async function loadMatchViewForChild(childId: string): Promise<PublicMatchView | null> {
    const match = await getMatchForChild(childId);
    if (!match) return null;
    const turns = await listTurns(match.id);
    return sanitizeMatch(match, turns, childId);
}

function computeAttackerReward(attempt: number, tokensUsed?: number) {
    const base = 1000;
    const attemptPenalty = attempt * 50;
    const tokenPenalty = Math.floor((tokensUsed ?? 0) / 5);
    return Math.max(100, base - attemptPenalty - tokenPenalty);
}

export async function recordAttackAttempt(params: {
    matchId?: string;
    childId: string;
    attackerPrompt: string;
}): Promise<PublicMatchView> {
    const db = assertAdminDb();
    const match = params.matchId
        ? await getMatchById(params.matchId)
        : await getMatchForChild(params.childId);
    if (!match) throw new Error("No active match found");
    if (match.attackerChildId !== params.childId) throw new Error("You are not the attacker");
    if (match.currentPhase !== "ATTACK_PHASE") throw new Error("Not your turn to attack");
    if (match.status === "completed" || match.currentPhase === "COMPLETED") {
        throw new Error("Match is already complete");
    }

    const attempt = match.attemptCount + 1;
    const { text, tokensUsed } = await generateJailbreakReply({
        adminPrompt: match.adminPrompt,
        developerPrompt: match.developerPrompt,
        attackerPrompt: params.attackerPrompt,
    });
    const verdict = await judgeJailbreakBreach({
        breachCriteria: match.breachCriteria,
        aiResponse: text,
    });

    const turnPayload: Omit<JailbreakTurn, "id"> = {
        matchId: match.id,
        attackerPrompt: params.attackerPrompt,
        aiResponse: text,
        breach: verdict.breach,
        refereeReason: verdict.reason,
        tokensUsed,
        createdAt: FieldValue.serverTimestamp() as unknown as JailbreakTurn["createdAt"],
    };

    const turnRef = db.collection(MATCH_COLLECTION).doc(match.id).collection("turns").doc();
    await turnRef.set(turnPayload);

    const cracksCompleted = verdict.breach ? match.cracksCompleted + 1 : match.cracksCompleted;
    let currentPhase: MatchPhase = verdict.breach ? "DEFENDER_PATCH" : "ATTACK_PHASE";
    let status: JailbreakMatch["status"] = match.status ?? "active";
    let attackerScore = match.attackerScore;
    let defenderScore = match.defenderScore;
    const attemptCount = verdict.breach ? 0 : attempt;

    if (verdict.breach) {
        attackerScore += computeAttackerReward(attempt, tokensUsed);
        if (cracksCompleted >= 3) {
            currentPhase = "COMPLETED";
            status = "completed";
        }
    } else {
        defenderScore += 50; // resilience points
    }

    await db.collection(MATCH_COLLECTION).doc(match.id).update({
        cracksCompleted,
        currentPhase,
        status,
        attackerScore,
        defenderScore,
        attemptCount,
        updatedAt: FieldValue.serverTimestamp(),
        lastResponse: text,
    });

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");
    return sanitizeMatch(updatedMatch, turns, params.childId);
}

export async function* streamAttackAttempt(params: {
    matchId?: string;
    childId: string;
    attackerPrompt: string;
}): AsyncGenerator<
    | { type: "chunk"; content: string }
    | { type: "complete"; match: PublicMatchView },
    void,
    undefined
> {
    const db = assertAdminDb();
    const match = params.matchId
        ? await getMatchById(params.matchId)
        : await getMatchForChild(params.childId);
    if (!match) throw new Error("No active match found");
    if (match.attackerChildId !== params.childId) throw new Error("You are not the attacker");
    if (match.currentPhase !== "ATTACK_PHASE") throw new Error("Not your turn to attack");
    if (match.status === "completed" || match.currentPhase === "COMPLETED") {
        throw new Error("Match is already complete");
    }

    await requireSectionTwoCue();
    await requireSectionOneComplete(params.childId);

    const attempt = match.attemptCount + 1;
    const stream = streamJailbreakReply({
        adminPrompt: match.adminPrompt,
        developerPrompt: match.developerPrompt,
        attackerPrompt: params.attackerPrompt,
    });

    let result: { fullText: string; tokensUsed?: number } | undefined;
    while (true) {
        const { value, done } = await stream.next();
        if (done) {
            result = value;
            break;
        }
        yield { type: "chunk", content: value };
    }

    if (!result) throw new Error("No response from AI");

    const verdict = await judgeJailbreakBreach({
        breachCriteria: match.breachCriteria,
        aiResponse: result.fullText,
    });

    const turnPayload: Omit<JailbreakTurn, "id"> = {
        matchId: match.id,
        attackerPrompt: params.attackerPrompt,
        aiResponse: result.fullText,
        breach: verdict.breach,
        refereeReason: verdict.reason,
        tokensUsed: result.tokensUsed,
        createdAt: FieldValue.serverTimestamp() as unknown as JailbreakTurn["createdAt"],
    };

    const turnRef = db.collection(MATCH_COLLECTION).doc(match.id).collection("turns").doc();
    await turnRef.set(turnPayload);

    const cracksCompleted = verdict.breach ? match.cracksCompleted + 1 : match.cracksCompleted;
    let currentPhase: MatchPhase = verdict.breach ? "DEFENDER_PATCH" : "ATTACK_PHASE";
    let status: JailbreakMatch["status"] = match.status ?? "active";
    let attackerScore = match.attackerScore;
    let defenderScore = match.defenderScore;
    const attemptCount = verdict.breach ? 0 : attempt;

    if (verdict.breach) {
        attackerScore += computeAttackerReward(attempt, result.tokensUsed);
        if (cracksCompleted >= 3) {
            currentPhase = "COMPLETED";
            status = "completed";
        }
    } else {
        defenderScore += 50;
    }

    await db.collection(MATCH_COLLECTION).doc(match.id).update({
        cracksCompleted,
        currentPhase,
        status,
        attackerScore,
        defenderScore,
        attemptCount,
        updatedAt: FieldValue.serverTimestamp(),
        lastResponse: result.fullText,
    });

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");

    yield { type: "complete", match: sanitizeMatch(updatedMatch, turns, params.childId) };
}

export async function applyDefenderPatch(params: {
    matchId?: string;
    childId: string;
    developerPrompt: string;
}): Promise<PublicMatchView> {
    const db = assertAdminDb();
    const match = params.matchId
        ? await getMatchById(params.matchId)
        : await getMatchForChild(params.childId);
    if (!match) throw new Error("No active match found");
    if (match.defenderChildId !== params.childId) throw new Error("You are not the defender");
    if (match.currentPhase !== "DEFENDER_PATCH") {
        throw new Error("You can edit only after a breach");
    }
    if (match.status === "completed" || match.currentPhase === "COMPLETED") {
        throw new Error("Match is already complete");
    }

    await db.collection(MATCH_COLLECTION).doc(match.id).update({
        developerPrompt: params.developerPrompt,
        currentPhase: "ATTACK_PHASE",
        attemptCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");
    return sanitizeMatch(updatedMatch, turns, params.childId);
}
