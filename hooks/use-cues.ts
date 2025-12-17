"use client";

import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";

import { gameCuesCollection } from "@/lib/collections";
import { GameCue } from "@/lib/game-types";

type CueState = {
    loading: boolean;
    cues: GameCue[];
    error?: string;
};

export function useCues(): CueState {
    const [state, setState] = useState<CueState>({ loading: true, cues: [] });

    useEffect(() => {
        const q = query(gameCuesCollection, orderBy("updatedAt", "desc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const cues = snap.docs.map((d) => d.data());
                setState({ loading: false, cues });
            },
            (err) => setState({ loading: false, cues: [], error: err.message })
        );

        return () => unsub();
    }, []);

    return state;
}
