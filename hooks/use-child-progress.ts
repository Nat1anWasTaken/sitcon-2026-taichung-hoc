"use client";

import { useMemo } from "react";

import { getDefaultSectionProgress } from "@/lib/child-progress";
import { SectionProgress } from "@/lib/game-types";
import { usePolling } from "./use-polling";

type ProgressState = {
    loading: boolean;
    error?: string;
    progress: Record<string, SectionProgress>;
};

export function useChildProgress(childId: string, sectionIds: string[]): ProgressState {
    const { data, loading, error } = usePolling<Record<string, SectionProgress>>(
        childId ? `/api/game/progress?childId=${encodeURIComponent(childId)}` : "",
        5000,
        {
            enabled: Boolean(childId),
            select: (payload) =>
                (payload as { progress: Record<string, SectionProgress> }).progress ?? {},
            transform: (progress) => {
                const next = { ...progress };
                sectionIds.forEach((id) => {
                    const current = next[id];
                    const defaults = getDefaultSectionProgress(id);
                    next[id] = current ? { ...defaults, ...current } : defaults;
                });
                return next;
            },
        }
    );

    return useMemo(
        () => ({
            loading,
            error,
            progress: data ?? {},
        }),
        [data, error, loading]
    );
}
