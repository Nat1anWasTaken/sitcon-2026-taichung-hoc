"use client";

import { useMemo } from "react";

import { GardenLevel, GardenPhase } from "@/lib/garden-types";
import { usePolling } from "./use-polling";

export type GardenContentState = {
    loading: boolean;
    phases: GardenPhase[];
    levels: GardenLevel[];
    error?: string;
    refresh: () => Promise<void>;
};

export function useGardenContent(): GardenContentState {
    const {
        data: phases,
        loading: phaseLoading,
        error: phaseError,
        refetch: refetchPhases,
    } = usePolling<GardenPhase[]>("/api/admin/garden/phases", 5000, {
        select: (payload) => (payload as { phases: GardenPhase[] }).phases ?? [],
        transform: (items) => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    });

    const {
        data: levels,
        loading: levelLoading,
        error: levelError,
        refetch: refetchLevels,
    } = usePolling<GardenLevel[]>("/api/admin/garden/levels", 5000, {
        select: (payload) => (payload as { levels: GardenLevel[] }).levels ?? [],
        transform: (items) =>
            [...items].sort((a, b) => (a.levelNumber ?? 0) - (b.levelNumber ?? 0)),
    });

    const error = phaseError ?? levelError;

    return useMemo(
        () => ({
            loading: phaseLoading || levelLoading,
            phases: phases ?? [],
            levels: levels ?? [],
            error,
            refresh: async () => {
                await Promise.all([refetchPhases(), refetchLevels()]);
            },
        }),
        [phaseLoading, levelLoading, phases, levels, error, refetchPhases, refetchLevels]
    );
}
