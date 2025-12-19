"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { JailbreakMatch, JailbreakTheme } from "@/lib/jailbreak-types";
import { fetchJson, getErrorMessage } from "@/lib/query-utils";

type ThemeState = {
    loading: boolean;
    themes: JailbreakTheme[];
    error?: string;
    refresh: () => Promise<void>;
};

type MatchState = {
    loading: boolean;
    matches: JailbreakMatch[];
    error?: string;
    refresh: () => Promise<void>;
};

export function useJailbreakThemes(): ThemeState {
    const query = useQuery({
        queryKey: ["admin", "jailbreak", "themes"],
        queryFn: () => fetchJson<{ themes: JailbreakTheme[] }>("/api/admin/jailbreak/themes"),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        select: (payload) =>
            [...(payload.themes ?? [])].sort((a, b) => {
                const fallback = Number.MAX_SAFE_INTEGER; // Items without timestamp appear first
                const tA = a.createdAt ? new Date(a.createdAt).getTime() : fallback;
                const tB = b.createdAt ? new Date(b.createdAt).getTime() : fallback;
                return tB - tA;
            }),
    });

    return useMemo(
        () => ({
            loading: query.isPending,
            themes: query.data ?? [],
            error: query.error
                ? getErrorMessage(query.error, "Failed to load jailbreak themes")
                : undefined,
            refresh: () => query.refetch().then(() => undefined),
        }),
        [query.data, query.error, query.isPending, query.refetch]
    );
}

export function useJailbreakMatches(): MatchState {
    const query = useQuery({
        queryKey: ["admin", "jailbreak", "matches"],
        queryFn: () => fetchJson<{ matches: JailbreakMatch[] }>("/api/admin/jailbreak/matches"),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        select: (payload) =>
            [...(payload.matches ?? [])].sort((a, b) => {
                const fallback = Number.MAX_SAFE_INTEGER;
                const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : fallback;
                const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : fallback;
                return tB - tA;
            }),
    });

    return useMemo(
        () => ({
            loading: query.isPending,
            matches: query.data ?? [],
            error: query.error
                ? getErrorMessage(query.error, "Failed to load jailbreak matches")
                : undefined,
            refresh: () => query.refetch().then(() => undefined),
        }),
        [query.data, query.error, query.isPending, query.refetch]
    );
}
