"use client";

import { useMemo } from "react";

import { JailbreakMatch, JailbreakTheme } from "@/lib/jailbreak-types";
import { usePolling } from "./use-polling";

type ThemeState = {
    loading: boolean;
    themes: JailbreakTheme[];
    error?: string;
};

type MatchState = {
    loading: boolean;
    matches: JailbreakMatch[];
    error?: string;
};

export function useJailbreakThemes(): ThemeState {
    const { data, loading, error } = usePolling<JailbreakTheme[]>(
        "/api/admin/jailbreak/themes",
        5000,
        {
            select: (payload) =>
                (payload as { themes: JailbreakTheme[] }).themes ?? [],
            transform: (themes) =>
                [...themes].sort((a, b) => {
                    const tA = a.createdAt?.toMillis?.() ?? Date.now() + 100000;
                    const tB = b.createdAt?.toMillis?.() ?? Date.now() + 100000;
                    return tB - tA;
                }),
        }
    );

    return useMemo(
        () => ({ loading, themes: data ?? [], error }),
        [data, error, loading]
    );
}

export function useJailbreakMatches(): MatchState {
    const { data, loading, error } = usePolling<JailbreakMatch[]>(
        "/api/admin/jailbreak/matches",
        5000,
        {
            select: (payload) =>
                (payload as { matches: JailbreakMatch[] }).matches ?? [],
            transform: (matches) =>
                [...matches].sort((a, b) => {
                    const tA = a.updatedAt?.toMillis?.() ?? Date.now() + 100000;
                    const tB = b.updatedAt?.toMillis?.() ?? Date.now() + 100000;
                    return tB - tA;
                }),
        }
    );

    return useMemo(
        () => ({ loading, matches: data ?? [], error }),
        [data, error, loading]
    );
}
