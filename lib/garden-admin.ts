"use client";

type PhaseInput = {
    title: string;
    mode: "blocks" | "text";
    description?: string;
    order: number;
    lockedByCue?: string;
};

async function apiRequest(url: string, init?: RequestInit) {
    const res = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Request failed");
    }
}

export async function createGardenPhase(input: PhaseInput) {
    await apiRequest("/api/admin/garden/phases", {
        method: "POST",
        body: JSON.stringify({
            ...input,
            lockedByCue: input.lockedByCue || null,
        }),
    });
}

export async function updateGardenPhase(phaseId: string, input: PhaseInput) {
    await apiRequest(`/api/admin/garden/phases/${encodeURIComponent(phaseId)}`, {
        method: "PATCH",
        body: JSON.stringify({
            ...input,
            lockedByCue: input.lockedByCue || null,
        }),
    });
}

export async function deleteGardenPhase(phaseId: string) {
    await apiRequest(`/api/admin/garden/phases/${encodeURIComponent(phaseId)}`, {
        method: "DELETE",
    });
}

type LevelInput = {
    phaseId: string;
    levelNumber: number;
    target: string;
    blocks?: string[];
    bonusBlocks?: string[];
    hint?: string;
};

export async function createGardenLevel(input: LevelInput) {
    await apiRequest("/api/admin/garden/levels", {
        method: "POST",
        body: JSON.stringify({
            ...input,
            blocks: input.blocks?.filter(Boolean) ?? [],
            bonusBlocks: input.bonusBlocks?.filter(Boolean) ?? [],
            hint: input.hint ?? "",
        }),
    });
}

export async function updateGardenLevel(levelId: string, input: LevelInput) {
    await apiRequest(`/api/admin/garden/levels/${encodeURIComponent(levelId)}`, {
        method: "PATCH",
        body: JSON.stringify({
            ...input,
            blocks: input.blocks?.filter(Boolean) ?? [],
            bonusBlocks: input.bonusBlocks?.filter(Boolean) ?? [],
            hint: input.hint ?? "",
        }),
    });
}

export async function deleteGardenLevel(levelId: string) {
    await apiRequest(`/api/admin/garden/levels/${encodeURIComponent(levelId)}`, {
        method: "DELETE",
    });
}

export async function resetGardenToSeed() {
    await apiRequest("/api/admin/garden/reset", { method: "POST" });
}
