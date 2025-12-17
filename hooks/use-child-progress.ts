"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { sectionProgressCollection } from "@/lib/collections";
import { getDefaultSectionProgress, mergeSectionProgressSnapshot } from "@/lib/child-progress";
import { SectionProgress } from "@/lib/game-types";

type ProgressState = {
    loading: boolean;
    error?: string;
    progress: Record<string, SectionProgress>;
};

export function useChildProgress(childId: string, sectionIds: string[]): ProgressState {
    const [state, setState] = useState<ProgressState>({
        loading: true,
        progress: {},
    });

    useEffect(() => {
        if (!childId) return;
        const unsubscribe = onSnapshot(
            sectionProgressCollection(childId),
            (snap) => {
                const data: Record<string, SectionProgress> = {};
                snap.forEach((doc) => {
                    data[doc.id] = mergeSectionProgressSnapshot(doc.id, doc);
                });
                // Ensure missing sections still surface with defaults for the UI.
                sectionIds.forEach((id) => {
                    if (!data[id]) {
                        data[id] = getDefaultSectionProgress(id);
                    }
                });
                setState({ loading: false, progress: data });
            },
            (err) => {
                setState((prev) => ({ ...prev, loading: false, error: err.message }));
            }
        );
        return () => unsubscribe();
    }, [childId, sectionIds]);

    return state;
}
