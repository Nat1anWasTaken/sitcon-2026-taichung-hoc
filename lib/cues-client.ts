"use client";

export async function setCueActive(
    cueId: string,
    active: boolean,
    payload?: Record<string, unknown>
) {
    const res = await fetch(`/api/admin/cues/${encodeURIComponent(cueId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            active,
            ...(payload !== undefined ? { payload } : {}),
        }),
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to update cue");
    }
}
