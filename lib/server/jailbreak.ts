import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { generateJailbreakReply, judgeJailbreakBreach, streamJailbreakReply } from "@/lib/ai";
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
const TURN_DURATION_MS = 60_000;

function buildTurnDeadline() {
    return Timestamp.fromMillis(Date.now() + TURN_DURATION_MS);
}

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
const THEMES_COLLECTION = "jailbreakThemes";

async function getTotalThemeCount(): Promise<number> {
    const db = assertAdminDb();
    const themesSnap = await db.collection(THEMES_COLLECTION).get();
    return themesSnap.size;
}

async function selectNextTheme(
    match: JailbreakMatch
): Promise<{
    themeId: string;
    themeTitle: string;
    themeDescription: string;
    adminPrompt: string;
    breachCriteria: string;
} | null> {
    const db = assertAdminDb();
    const themesSnap = await db.collection(THEMES_COLLECTION).get();

    const completedIds = match.completedThemeIds ?? [];
    const availableThemes = themesSnap.docs
        .filter((doc) => !completedIds.includes(doc.id))
        .map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title as string,
                description: data.description as string,
                adminPrompt: data.adminPrompt as string,
                breachCriteria: data.breachCriteria as string,
            };
        });

    if (availableThemes.length === 0) return null;

    // Pick the first available theme (could randomize if desired)
    const next = availableThemes[0];
    return {
        themeId: next.id,
        themeTitle: next.title,
        themeDescription: next.description,
        adminPrompt: next.adminPrompt,
        breachCriteria: next.breachCriteria,
    };
}

async function fetchMatchDoc(matchId: string): Promise<JailbreakMatch | null> {
    const db = assertAdminDb();
    const snap = await db.collection(MATCH_COLLECTION).doc(matchId).get();
    if (!snap.exists) return null;
    const rest = snap.data() as JailbreakMatch;
    return { ...rest, id: snap.id };
}

async function resolveExpiredPhase(match: JailbreakMatch): Promise<JailbreakMatch> {
    if (match.currentPhase === "COMPLETED") {
        return match;
    }

    if (!match.phaseExpiresAt) {
        const db = assertAdminDb();
        await db.collection(MATCH_COLLECTION).doc(match.id).update({
            phaseExpiresAt: buildTurnDeadline(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        const refreshed = await fetchMatchDoc(match.id);
        return refreshed ?? match;
    }

    const now = Date.now();
    if (match.phaseExpiresAt.toMillis() > now) return match;

    const db = assertAdminDb();
    let update: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (match.currentPhase === "ATTACK_PHASE") {
        const nextAttempt = match.attemptCount + 1;
        const attemptCount = nextAttempt >= 3 ? 0 : nextAttempt;
        const currentPhase: MatchPhase = nextAttempt >= 3 ? "DEFENDER_PATCH" : "ATTACK_PHASE";
        update = {
            ...update,
            attemptCount,
            defenderScore: match.defenderScore + 50,
            currentPhase,
            phaseExpiresAt: Timestamp.fromMillis(now + TURN_DURATION_MS),
        };
    } else if (match.currentPhase === "DEFENDER_PATCH") {
        update = {
            ...update,
            currentPhase: "ATTACK_PHASE",
            attemptCount: 0,
            phaseExpiresAt: Timestamp.fromMillis(now + TURN_DURATION_MS),
        };
    }

    await db.collection(MATCH_COLLECTION).doc(match.id).update(update);
    const refreshed = await fetchMatchDoc(match.id);
    return refreshed ?? match;
}

async function getMatchById(matchId: string): Promise<JailbreakMatch | null> {
    const base = await fetchMatchDoc(matchId);
    if (!base) return null;
    return resolveExpiredPhase(base);
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
        return resolveExpiredPhase({ ...rest, id: doc.id });
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
        return resolveExpiredPhase({ ...rest, id: doc.id });
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

async function sanitizeMatch(
    match: JailbreakMatch,
    turns: JailbreakTurn[],
    childId: string
): Promise<PublicMatchView> {
    const role = match.attackerChildId === childId ? "attacker" : "defender";
    const totalThemes = await getTotalThemeCount();
    const themesCompleted = (match.completedThemeIds ?? []).length;

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
        breachCriteria: role === "defender" ? match.breachCriteria : undefined,
        phaseExpiresAt: match.phaseExpiresAt?.toDate().toISOString(),
        themesCompleted,
        totalThemes,
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
    return await sanitizeMatch(match, turns, childId);
}

function computeAttackerReward(attempt: number, tokensUsed?: number) {
    const base = 1000;
    const attemptPenalty = attempt * 50;
    const tokenPenalty = Math.floor((tokensUsed ?? 0) / 5);
    return Math.max(100, base - attemptPenalty - tokenPenalty);
}

function buildMatchUpdateWithRoleSwap(params: {
    match: JailbreakMatch;
    shouldSwapRoles: boolean;
    cracksCompleted: number;
    currentPhase: MatchPhase;
    status: JailbreakMatch["status"];
    attackerScore: number;
    defenderScore: number;
    attemptCount: number;
    lastResponse: string;
}): Record<string, unknown> {
    const {
        match,
        shouldSwapRoles,
        cracksCompleted,
        currentPhase,
        status,
        attackerScore,
        defenderScore,
        attemptCount,
        lastResponse,
    } = params;

    const updatePayload: Record<string, unknown> = {
        cracksCompleted,
        currentPhase,
        status,
        attemptCount,
        phaseExpiresAt: currentPhase === "COMPLETED" ? FieldValue.delete() : buildTurnDeadline(),
        updatedAt: FieldValue.serverTimestamp(),
        lastResponse,
    };

    if (shouldSwapRoles) {
        // Swap attacker and defender roles
        updatePayload.attackerChildId = match.defenderChildId;
        updatePayload.defenderChildId = match.attackerChildId;
        updatePayload.attackerSeat = match.defenderSeat;
        updatePayload.defenderSeat = match.attackerSeat;
        updatePayload.attackerName = match.defenderName;
        updatePayload.defenderName = match.attackerName;
        updatePayload.attackerScore = defenderScore;
        updatePayload.defenderScore = attackerScore;
    } else {
        updatePayload.attackerScore = attackerScore;
        updatePayload.defenderScore = defenderScore;
    }

    return updatePayload;
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
    if (match.status === "completed") {
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

    let cracksCompleted = verdict.breach ? match.cracksCompleted + 1 : match.cracksCompleted;
    let currentPhase: MatchPhase =
        verdict.breach || attempt >= 3 ? "DEFENDER_PATCH" : "ATTACK_PHASE";
    let status: JailbreakMatch["status"] = match.status ?? "active";
    let attackerScore = match.attackerScore;
    let defenderScore = match.defenderScore;
    const attemptCount = verdict.breach || attempt >= 3 ? 0 : attempt;

    let shouldSwapRoles = false;
    let completedThemeIds = match.completedThemeIds ?? [];
    let themeId = match.themeId;
    let themeTitle = match.themeTitle;
    let themeDescription = match.themeDescription;
    let adminPrompt = match.adminPrompt;
    let breachCriteria = match.breachCriteria;
    let developerPrompt = match.developerPrompt;

    if (verdict.breach) {
        attackerScore += computeAttackerReward(attempt, tokensUsed);
        if (cracksCompleted >= 3) {
            // Theme completed! Add to completed list
            completedThemeIds = [...completedThemeIds, match.themeId];

            // Try to get next theme
            const nextTheme = await selectNextTheme({ ...match, completedThemeIds });

            if (nextTheme) {
                // Progress to next theme
                themeId = nextTheme.themeId;
                themeTitle = nextTheme.themeTitle;
                themeDescription = nextTheme.themeDescription;
                adminPrompt = nextTheme.adminPrompt;
                breachCriteria = nextTheme.breachCriteria;
                developerPrompt = "";
                cracksCompleted = 0;
                shouldSwapRoles = true;
                currentPhase = "DEFENDER_PATCH";
            } else {
                // No more themes - match is complete
                currentPhase = "COMPLETED";
                status = "completed";
            }
        } else {
            shouldSwapRoles = true;
        }
    } else {
        defenderScore += 50;
    }

    const updatePayload = buildMatchUpdateWithRoleSwap({
        match,
        shouldSwapRoles,
        cracksCompleted,
        currentPhase,
        status,
        attackerScore,
        defenderScore,
        attemptCount,
        lastResponse: text,
    });

    // Add theme progression fields
    updatePayload.completedThemeIds = completedThemeIds;
    updatePayload.themeId = themeId;
    updatePayload.themeTitle = themeTitle;
    updatePayload.themeDescription = themeDescription;
    updatePayload.adminPrompt = adminPrompt;
    updatePayload.breachCriteria = breachCriteria;
    updatePayload.developerPrompt = developerPrompt;

    await db.collection(MATCH_COLLECTION).doc(match.id).update(updatePayload);

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");
    return await sanitizeMatch(updatedMatch, turns, params.childId);
}

export async function* streamAttackAttempt(params: {
    matchId?: string;
    childId: string;
    attackerPrompt: string;
}): AsyncGenerator<
    { type: "chunk"; content: string } | { type: "complete"; match: PublicMatchView },
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
    if (match.status === "completed") {
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

    let cracksCompleted = verdict.breach ? match.cracksCompleted + 1 : match.cracksCompleted;
    let currentPhase: MatchPhase =
        verdict.breach || attempt >= 3 ? "DEFENDER_PATCH" : "ATTACK_PHASE";
    let status: JailbreakMatch["status"] = match.status ?? "active";
    let attackerScore = match.attackerScore;
    let defenderScore = match.defenderScore;
    const attemptCount = verdict.breach || attempt >= 3 ? 0 : attempt;

    let shouldSwapRoles = false;
    let completedThemeIds = match.completedThemeIds ?? [];
    let themeId = match.themeId;
    let themeTitle = match.themeTitle;
    let themeDescription = match.themeDescription;
    let adminPrompt = match.adminPrompt;
    let breachCriteria = match.breachCriteria;
    let developerPrompt = match.developerPrompt;

    if (verdict.breach) {
        attackerScore += computeAttackerReward(attempt, result.tokensUsed);
        if (cracksCompleted >= 3) {
            // Theme completed! Add to completed list
            completedThemeIds = [...completedThemeIds, match.themeId];

            // Try to get next theme
            const nextTheme = await selectNextTheme({ ...match, completedThemeIds });

            if (nextTheme) {
                // Progress to next theme
                themeId = nextTheme.themeId;
                themeTitle = nextTheme.themeTitle;
                themeDescription = nextTheme.themeDescription;
                adminPrompt = nextTheme.adminPrompt;
                breachCriteria = nextTheme.breachCriteria;
                developerPrompt = "";
                cracksCompleted = 0;
                shouldSwapRoles = true;
                currentPhase = "DEFENDER_PATCH";
            } else {
                // No more themes - match is complete
                currentPhase = "COMPLETED";
                status = "completed";
            }
        } else {
            shouldSwapRoles = true;
        }
    } else {
        defenderScore += 50;
    }

    const updatePayload = buildMatchUpdateWithRoleSwap({
        match,
        shouldSwapRoles,
        cracksCompleted,
        currentPhase,
        status,
        attackerScore,
        defenderScore,
        attemptCount,
        lastResponse: result.fullText,
    });

    // Add theme progression fields
    updatePayload.completedThemeIds = completedThemeIds;
    updatePayload.themeId = themeId;
    updatePayload.themeTitle = themeTitle;
    updatePayload.themeDescription = themeDescription;
    updatePayload.adminPrompt = adminPrompt;
    updatePayload.breachCriteria = breachCriteria;
    updatePayload.developerPrompt = developerPrompt;

    await db.collection(MATCH_COLLECTION).doc(match.id).update(updatePayload);

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");

    yield { type: "complete", match: await sanitizeMatch(updatedMatch, turns, params.childId) };
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
    if (match.status === "completed") {
        throw new Error("Match is already complete");
    }

    await db.collection(MATCH_COLLECTION).doc(match.id).update({
        developerPrompt: params.developerPrompt,
        currentPhase: "ATTACK_PHASE",
        attemptCount: 0,
        phaseExpiresAt: buildTurnDeadline(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");
    return await sanitizeMatch(updatedMatch, turns, params.childId);
}

export async function flipMatchRoles(matchId: string): Promise<void> {
    const db = assertAdminDb();
    const match = await getMatchById(matchId);
    if (!match) throw new Error("Match not found");

    await db.collection(MATCH_COLLECTION).doc(matchId).update({
        attackerChildId: match.defenderChildId,
        defenderChildId: match.attackerChildId,
        attackerSeat: match.defenderSeat,
        defenderSeat: match.attackerSeat,
        attackerName: match.defenderName,
        defenderName: match.attackerName,
        attackerScore: match.defenderScore,
        defenderScore: match.attackerScore,
        updatedAt: FieldValue.serverTimestamp(),
    });
}
