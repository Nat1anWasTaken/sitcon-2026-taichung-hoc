"use client";

import { useMemo } from "react";

import { JailbreakMatch, JailbreakTheme } from "@/lib/jailbreak-types";
import { usePolling } from "./use-polling";

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
    const { data, loading, error, refetch } = usePolling<JailbreakTheme[]>(
        "/api/admin/jailbreak/themes",
        5000,
        {
            select: (payload) =>
                (payload as { themes: JailbreakTheme[] }).themes ?? [],
            transform: (themes) =>
                [...themes].sort((a, b) => {
                    const fallback = Number.MAX_SAFE_INTEGER; // Items without timestamp appear first
                    const tA = a.createdAt ? new Date(a.createdAt).getTime() : fallback;
                    const tB = b.createdAt ? new Date(b.createdAt).getTime() : fallback;
                    return tB - tA;
                }),
        }
    );

    return useMemo(
        () => ({ loading, themes: data ?? [], error, refresh: refetch }),
        [data, error, loading, refetch]
    );
}

export function useJailbreakMatches(): MatchState {
    const { data, loading, error, refetch } = usePolling<JailbreakMatch[]>(
        "/api/admin/jailbreak/matches",
        5000,
        {
            select: (payload) =>
                (payload as { matches: JailbreakMatch[] }).matches ?? [],
            transform: (matches) =>
                [...matches].sort((a, b) => {
                    const fallback = Number.MAX_SAFE_INTEGER;
                    const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : fallback;
                    const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : fallback;
                    return tB - tA;
                }),
        }
    );

    return useMemo(
        () => ({ loading, matches: data ?? [], error, refresh: refetch }),
        [data, error, loading, refetch]
    );
}
