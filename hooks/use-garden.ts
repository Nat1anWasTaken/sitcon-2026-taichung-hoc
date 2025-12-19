"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { GardenLevel, GardenPhase } from "@/lib/garden-types";
import { fetchJson, getErrorMessage } from "@/lib/query-utils";

export type GardenContentState = {
    loading: boolean;
    phases: GardenPhase[];
    levels: GardenLevel[];
    error?: string;
    refresh: () => Promise<void>;
};

export function useGardenContent(): GardenContentState {
    const phaseQuery = useQuery({
        queryKey: ["admin", "garden", "phases"],
        queryFn: () => fetchJson<{ phases: GardenPhase[] }>("/api/admin/garden/phases"),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        select: (payload) =>
            [...(payload.phases ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    });

    const levelQuery = useQuery({
        queryKey: ["admin", "garden", "levels"],
        queryFn: () => fetchJson<{ levels: GardenLevel[] }>("/api/admin/garden/levels"),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        select: (payload) =>
            [...(payload.levels ?? [])].sort(
                (a, b) => (a.levelNumber ?? 0) - (b.levelNumber ?? 0)
            ),
    });

    const rawError = phaseQuery.error ?? levelQuery.error;
    const error = rawError ? getErrorMessage(rawError, "Failed to load garden data") : undefined;

    return useMemo(
        () => ({
            loading: phaseQuery.isPending || levelQuery.isPending,
            phases: phaseQuery.data ?? [],
            levels: levelQuery.data ?? [],
            error,
            refresh: async () => {
                await Promise.all([phaseQuery.refetch(), levelQuery.refetch()]);
            },
        }),
        [
            error,
            levelQuery.data,
            levelQuery.isPending,
            levelQuery.refetch,
            phaseQuery.data,
            phaseQuery.isPending,
            phaseQuery.refetch,
        ]
    );
}
