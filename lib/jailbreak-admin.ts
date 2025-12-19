"use client";

import { JailbreakDifficulty, JailbreakMatch } from "./jailbreak-types";

type CreateThemeInput = {
    title: string;
    description: string;
    difficulty: JailbreakDifficulty;
    adminPrompt: string;
    breachCriteria: string;
};

export async function createJailbreakTheme(input: CreateThemeInput) {
    const res = await fetch("/api/admin/jailbreak/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to create theme");
    }
}

export async function updateJailbreakTheme(themeId: string, input: CreateThemeInput) {
    const res = await fetch(`/api/admin/jailbreak/themes/${encodeURIComponent(themeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to update theme");
    }
}

export async function deleteJailbreakTheme(themeId: string) {
    const res = await fetch(`/api/admin/jailbreak/themes/${encodeURIComponent(themeId)}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to delete theme");
    }
}

type CreateMatchInput = {
    themeId: string;
    attackerChildId: string;
    defenderChildId: string;
};

export async function createJailbreakMatch({
    themeId,
    attackerChildId,
    defenderChildId,
}: CreateMatchInput) {
    const res = await fetch("/api/admin/jailbreak/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId, attackerChildId, defenderChildId }),
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to create match");
    }
    const data = (await res.json()) as { matchId: string };
    return data.matchId;
}

export async function resetMatchToTheme(matchId: string, themeId: string) {
    const res = await fetch(
        `/api/admin/jailbreak/matches/${encodeURIComponent(matchId)}/reset`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ themeId }),
        }
    );
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to reset match");
    }
}

export async function setMatchStatus(matchId: string, status: JailbreakMatch["status"]) {
    const res = await fetch(`/api/admin/jailbreak/matches/${encodeURIComponent(matchId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to update match");
    }
}

export async function resetJailbreakToSeed() {
    const res = await fetch("/api/admin/jailbreak/themes/reset", { method: "POST" });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to reset themes");
    }
}

export async function flipMatchRoles(matchId: string) {
    const res = await fetch(
        `/api/admin/jailbreak/matches/${encodeURIComponent(matchId)}/flip`,
        {
            method: "POST",
        }
    );
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to flip roles");
    }
}
