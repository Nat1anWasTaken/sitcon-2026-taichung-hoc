"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { GameCue } from "@/lib/game-types";
import { fetchJson, getErrorMessage } from "@/lib/query-utils";

type CueState = {
    loading: boolean;
    cues: GameCue[];
    error?: string;
    refresh: () => Promise<void>;
};

export function useCues(): CueState {
    const query = useQuery({
        queryKey: ["admin", "cues"],
        queryFn: () => fetchJson<{ cues: GameCue[] }>("/api/admin/cues"),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        select: (payload) =>
            [...(payload.cues ?? [])].sort((a, b) => {
                const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return tB - tA;
            }),
    });

    return useMemo(
        () => ({
            loading: query.isPending,
            cues: query.data ?? [],
            error: query.error
                ? getErrorMessage(query.error, "Failed to load cues")
                : undefined,
            refresh: () => query.refetch().then(() => undefined),
        }),
        [query.data, query.error, query.isPending, query.refetch]
    );
}
