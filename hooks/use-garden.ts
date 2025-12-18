"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";

import { gardenLevelsCollection, gardenPhasesCollection } from "@/lib/collections";
import { GardenLevel, GardenPhase } from "@/lib/garden-types";

export type GardenContentState = {
    loading: boolean;
    phases: GardenPhase[];
    levels: GardenLevel[];
    error?: string;
};

export function useGardenContent(): GardenContentState {
    const [phases, setPhases] = useState<GardenPhase[]>([]);
    const [levels, setLevels] = useState<GardenLevel[]>([]);
    const [phaseLoading, setPhaseLoading] = useState(true);
    const [levelLoading, setLevelLoading] = useState(true);
    const [error, setError] = useState<string | undefined>(undefined);

    useEffect(() => {
        const q = query(gardenPhasesCollection, orderBy("order", "asc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                setPhases(snap.docs.map((d) => d.data()));
                setPhaseLoading(false);
            },
            (err) => {
                setError(err.message);
                setPhaseLoading(false);
            }
        );

        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(gardenLevelsCollection, orderBy("levelNumber", "asc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                setLevels(snap.docs.map((d) => d.data()));
                setLevelLoading(false);
            },
            (err) => {
                setError(err.message);
                setLevelLoading(false);
            }
        );

        return () => unsub();
    }, []);

    return useMemo(
        () => ({
            loading: phaseLoading || levelLoading,
            phases,
            levels,
            error,
        }),
        [phaseLoading, levelLoading, phases, levels, error]
    );
}
