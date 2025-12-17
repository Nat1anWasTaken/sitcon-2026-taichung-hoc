"use client";

import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";

import {
    jailbreakMatchesCollection,
    jailbreakThemesCollection,
} from "@/lib/collections";
import { JailbreakMatch, JailbreakTheme } from "@/lib/jailbreak-types";

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
    const [state, setState] = useState<ThemeState>({ loading: true, themes: [] });

    useEffect(() => {
        const q = query(jailbreakThemesCollection, orderBy("createdAt", "desc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const themes = snap.docs.map((d) => d.data());
                setState({ loading: false, themes });
            },
            (err) => setState({ loading: false, themes: [], error: err.message })
        );
        return () => unsub();
    }, []);

    return state;
}

export function useJailbreakMatches(): MatchState {
    const [state, setState] = useState<MatchState>({ loading: true, matches: [] });

    useEffect(() => {
        const q = query(jailbreakMatchesCollection, orderBy("updatedAt", "desc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const matches = snap.docs.map((d) => d.data());
                setState({ loading: false, matches });
            },
            (err) => setState({ loading: false, matches: [], error: err.message })
        );
        return () => unsub();
    }, []);

    return state;
}
