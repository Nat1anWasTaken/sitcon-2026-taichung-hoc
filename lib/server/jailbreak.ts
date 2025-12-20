import { randomUUID } from "crypto";

import { generateJailbreakReply, judgeJailbreakBreach, streamJailbreakReply } from "@/lib/ai";
import { getCue } from "./cues";
import { getSectionProgress } from "./progress";
import { MatchPhase, PublicMatchView } from "../jailbreak-types";
import { connectToDatabase } from "../mongodb";
import { IJailbreakMatch, JailbreakMatchModel } from "../models/jailbreak-match";
import { IJailbreakTheme, JailbreakThemeModel } from "../models/jailbreak-theme";
import { IJailbreakTurn, JailbreakTurnModel } from "../models/jailbreak-turn";

const START_SECTION_TWO_CUE = "start-section-2";
const SECTION_ONE_ID = "section-1";
const TURN_DURATION_MS = 60_000;
const MAX_ATTACK_ATTEMPTS = 3;

function buildTurnDeadline() {
    return new Date(Date.now() + TURN_DURATION_MS);
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

async function getTotalThemeCount(): Promise<number> {
    await connectToDatabase();
    return JailbreakThemeModel.countDocuments();
}

async function selectNextTheme(
    match: IJailbreakMatch
): Promise<{
    themeId: string;
    themeTitle: string;
    themeDescription: string;
    adminPrompt: string;
    breachCriteria: string;
} | null> {
    const completedIds = match.completedThemeIds ?? [];
    await connectToDatabase();
    const themes = await JailbreakThemeModel.find({}).lean<IJailbreakTheme[]>();
    const availableThemes = themes.filter((theme) => !completedIds.includes(theme._id));

    if (availableThemes.length === 0) return null;

    // Pick the first available theme (could randomize if desired)
    const next = availableThemes[0];
    return {
        themeId: next.id ?? next._id,
        themeTitle: next.title,
        themeDescription: next.description,
        adminPrompt: next.adminPrompt,
        breachCriteria: next.breachCriteria,
    };
}

function withId<T extends { _id?: string; id?: string }>(doc: T) {
    const { _id, id, ...rest } = doc;
    return { ...rest, _id, id: id ?? _id } as T & { id: string };
}

async function fetchMatchDoc(matchId: string): Promise<IJailbreakMatch | null> {
    await connectToDatabase();
    const match = await JailbreakMatchModel.findById(matchId).lean<IJailbreakMatch | null>();
    if (!match) return null;
    return withId(match);
}

async function resolveExpiredPhase(match: IJailbreakMatch): Promise<IJailbreakMatch> {
    if (match.currentPhase === "COMPLETED") {
        return match;
    }

    if (!match.phaseExpiresAt) {
        await connectToDatabase();
        await JailbreakMatchModel.updateOne(
            { _id: match.id },
            { $set: { phaseExpiresAt: buildTurnDeadline(), updatedAt: new Date() } }
        );
        const refreshed = await fetchMatchDoc(match.id);
        return refreshed ?? match;
    }

    const now = Date.now();
    if (match.phaseExpiresAt.getTime() > now) return match;

    let update: Record<string, unknown> = {
        updatedAt: new Date(),
    };

    if (match.currentPhase === "ATTACK_PHASE") {
        update = {
            ...update,
            attemptCount: 0,
            defenderScore: match.defenderScore + 50,
            currentPhase: "DEFENDER_PATCH",
            phaseExpiresAt: new Date(now + TURN_DURATION_MS),
        };
    } else if (match.currentPhase === "DEFENDER_PATCH") {
        update = {
            ...update,
            currentPhase: "ATTACK_PHASE",
            attemptCount: 0,
            phaseExpiresAt: new Date(now + TURN_DURATION_MS),
        };
    }

    await connectToDatabase();
    await JailbreakMatchModel.updateOne({ _id: match.id }, { $set: update });
    const refreshed = await fetchMatchDoc(match.id);
    return refreshed ?? match;
}

async function getMatchById(matchId: string): Promise<IJailbreakMatch | null> {
    const base = await fetchMatchDoc(matchId);
    if (!base) return null;
    return resolveExpiredPhase(base);
}

async function getMatchForChild(childId: string): Promise<IJailbreakMatch | null> {
    await connectToDatabase();
    const attackerMatch = await JailbreakMatchModel.findOne({ attackerChildId: childId })
        .sort({ updatedAt: -1 })
        .lean<IJailbreakMatch | null>();
    if (attackerMatch) {
        return resolveExpiredPhase(withId(attackerMatch));
    }

    const defenderMatch = await JailbreakMatchModel.findOne({ defenderChildId: childId })
        .sort({ updatedAt: -1 })
        .lean<IJailbreakMatch | null>();
    if (defenderMatch) {
        return resolveExpiredPhase(withId(defenderMatch));
    }
    return null;
}

async function listTurns(matchId: string, limit = 20): Promise<IJailbreakTurn[]> {
    await connectToDatabase();
    const turns = await JailbreakTurnModel.find({ matchId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<IJailbreakTurn[]>();
    return turns.map((turn) => withId(turn));
}

async function sanitizeMatch(
    match: IJailbreakMatch,
    turns: IJailbreakTurn[],
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
        attemptCount: match.attemptCount,
        status: match.status,
        maxAttackAttempts: MAX_ATTACK_ATTEMPTS,
        adminPrompt: role === "defender" ? match.adminPrompt : undefined,
        developerPrompt: role === "defender" ? match.developerPrompt : undefined,
        breachCriteria: role === "defender" ? match.breachCriteria : undefined,
        phaseExpiresAt: match.phaseExpiresAt?.toISOString(),
        themesCompleted,
        totalThemes,
        logs: turns.map((t) => ({
            id: t.id ?? t._id,
            attackerPrompt: t.attackerPrompt,
            aiResponse: t.aiResponse,
            breach: t.breach,
            refereeReason: role === "defender" ? t.refereeReason : undefined,
            tokensUsed: t.tokensUsed,
            createdAt: t.createdAt.toISOString(),
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
    match: IJailbreakMatch;
    shouldSwapRoles: boolean;
    cracksCompleted: number;
    currentPhase: MatchPhase;
    status: IJailbreakMatch["status"];
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
        phaseExpiresAt: currentPhase === "COMPLETED" ? null : buildTurnDeadline(),
        updatedAt: new Date(),
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

function buildUpdateWithUnset(updatePayload: Record<string, unknown>) {
    const { phaseExpiresAt, ...rest } = updatePayload;
    const update: Record<string, unknown> = { $set: rest };
    if (phaseExpiresAt === null) {
        update.$unset = { phaseExpiresAt: "" };
    } else if (phaseExpiresAt !== undefined) {
        (update.$set as Record<string, unknown>).phaseExpiresAt = phaseExpiresAt;
    }
    return update;
}

export async function recordAttackAttempt(params: {
    matchId?: string;
    childId: string;
    attackerPrompt: string;
}): Promise<PublicMatchView> {
    await connectToDatabase();
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

    const turnId = randomUUID();
    const turnPayload: IJailbreakTurn = {
        _id: turnId,
        id: turnId,
        matchId: match.id,
        attackerPrompt: params.attackerPrompt,
        aiResponse: text,
        breach: verdict.breach,
        refereeReason: verdict.reason,
        tokensUsed,
        createdAt: new Date(),
    };
    await JailbreakTurnModel.create(turnPayload);

    let cracksCompleted = verdict.breach ? match.cracksCompleted + 1 : match.cracksCompleted;
    let currentPhase: MatchPhase =
        verdict.breach || attempt >= MAX_ATTACK_ATTEMPTS ? "DEFENDER_PATCH" : "ATTACK_PHASE";
    let status: IJailbreakMatch["status"] = match.status ?? "active";
    let attackerScore = match.attackerScore;
    let defenderScore = match.defenderScore;
    const attemptCount = verdict.breach || attempt >= MAX_ATTACK_ATTEMPTS ? 0 : attempt;

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
        if (cracksCompleted >= 1) {
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

    await JailbreakMatchModel.updateOne(
        { _id: match.id },
        buildUpdateWithUnset(updatePayload)
    );

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
    await connectToDatabase();
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

    const turnId = randomUUID();
    const turnPayload: IJailbreakTurn = {
        _id: turnId,
        id: turnId,
        matchId: match.id,
        attackerPrompt: params.attackerPrompt,
        aiResponse: result.fullText,
        breach: verdict.breach,
        refereeReason: verdict.reason,
        tokensUsed: result.tokensUsed,
        createdAt: new Date(),
    };
    await JailbreakTurnModel.create(turnPayload);

    let cracksCompleted = verdict.breach ? match.cracksCompleted + 1 : match.cracksCompleted;
    let currentPhase: MatchPhase =
        verdict.breach || attempt >= MAX_ATTACK_ATTEMPTS ? "DEFENDER_PATCH" : "ATTACK_PHASE";
    let status: IJailbreakMatch["status"] = match.status ?? "active";
    let attackerScore = match.attackerScore;
    let defenderScore = match.defenderScore;
    const attemptCount = verdict.breach || attempt >= MAX_ATTACK_ATTEMPTS ? 0 : attempt;

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
        if (cracksCompleted >= 1) {
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

    await JailbreakMatchModel.updateOne(
        { _id: match.id },
        buildUpdateWithUnset(updatePayload)
    );

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
    await connectToDatabase();
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

    await JailbreakMatchModel.updateOne(
        { _id: match.id },
        {
            $set: {
                developerPrompt: params.developerPrompt,
                currentPhase: "ATTACK_PHASE",
                attemptCount: 0,
                phaseExpiresAt: buildTurnDeadline(),
                updatedAt: new Date(),
            },
        }
    );

    const updatedMatch = await getMatchById(match.id);
    const turns = await listTurns(match.id);
    if (!updatedMatch) throw new Error("Failed to load updated match");
    return await sanitizeMatch(updatedMatch, turns, params.childId);
}

export async function flipMatchRoles(matchId: string): Promise<void> {
    await connectToDatabase();
    const match = await getMatchById(matchId);
    if (!match) throw new Error("Match not found");

    await JailbreakMatchModel.updateOne(
        { _id: matchId },
        {
            $set: {
                attackerChildId: match.defenderChildId,
                defenderChildId: match.attackerChildId,
                attackerSeat: match.defenderSeat,
                defenderSeat: match.attackerSeat,
                attackerName: match.defenderName,
                defenderName: match.attackerName,
                attackerScore: match.defenderScore,
                defenderScore: match.attackerScore,
                updatedAt: new Date(),
            },
        }
    );
}
