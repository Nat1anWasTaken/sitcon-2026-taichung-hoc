"use client";

import { useMemo } from "react";

import { GameCue } from "@/lib/game-types";
import { usePolling } from "./use-polling";

type CueState = {
    loading: boolean;
    cues: GameCue[];
    error?: string;
};

export function useCues(): CueState {
    const { data, loading, error } = usePolling<GameCue[]>("/api/admin/cues", 5000, {
        select: (payload) => (payload as { cues: GameCue[] }).cues ?? [],
        transform: (cues) =>
            [...cues].sort((a, b) => {
                const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return tB - tA;
            }),
    });

    return useMemo(
        () => ({ loading, cues: data ?? [], error }),
        [data, error, loading]
    );
}
