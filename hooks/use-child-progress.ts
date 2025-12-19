"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getDefaultSectionProgress } from "@/lib/child-progress";
import { SectionProgress } from "@/lib/game-types";
import { fetchJson, getErrorMessage } from "@/lib/query-utils";

type ProgressState = {
    loading: boolean;
    error?: string;
    progress: Record<string, SectionProgress>;
};

export function useChildProgress(childId: string, sectionIds: string[]): ProgressState {
    const query = useQuery({
        queryKey: ["game", "progress", childId],
        queryFn: () =>
            fetchJson<{ progress: Record<string, SectionProgress> }>(
                `/api/game/progress?childId=${encodeURIComponent(childId)}`
            ),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        enabled: Boolean(childId),
        select: (payload) => payload.progress ?? {},
    });

    const progress = useMemo(() => {
        const next = { ...(query.data ?? {}) };
        sectionIds.forEach((id) => {
            const current = next[id];
            const defaults = getDefaultSectionProgress(id);
            next[id] = current ? { ...defaults, ...current } : defaults;
        });
        return next;
    }, [query.data, sectionIds]);

    return useMemo(
        () => ({
            loading: query.isPending,
            error: query.error
                ? getErrorMessage(query.error, "Failed to load progress")
                : undefined,
            progress,
        }),
        [progress, query.error, query.isPending]
    );
}
