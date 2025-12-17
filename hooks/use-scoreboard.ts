"use client";

import { useEffect, useMemo, useState } from "react";

import { ScoreboardSection, ScoreboardSnapshot } from "@/lib/scoreboard-types";

export type ScoreboardState = {
    loading: boolean;
    error?: string;
    snapshot: ScoreboardSnapshot | null;
};

const FALLBACK_POLL_MS = 6000;

export function useScoreboard(): ScoreboardState {
    const [snapshot, setSnapshot] = useState<ScoreboardSnapshot | null>(null);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        let es: EventSource | null = null;
        let fallbackTimer: ReturnType<typeof setInterval> | null = null;
        let cancelled = false;

        const fetchOnce = async () => {
            try {
                const res = await fetch("/api/scoreboard?mode=json", { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as ScoreboardSnapshot;
                if (!cancelled) {
                    setSnapshot(data);
                    setError(undefined);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : "Unable to load scoreboard";
                    setError(message);
                }
            }
        };

        const connect = () => {
            if (typeof EventSource === "undefined") {
                // Safari private mode or very old browsers
                fallbackTimer = setInterval(fetchOnce, FALLBACK_POLL_MS);
                fetchOnce();
                return;
            }

            es = new EventSource("/api/scoreboard");
            es.onmessage = (event) => {
                const data = JSON.parse(event.data) as ScoreboardSnapshot;
                setSnapshot(data);
                setError(undefined);
            };
            es.onerror = () => {
                setError("Live connection lost. Reconnecting…");
                es?.close();
                es = null;
                // Try a quick reconnect; if it keeps failing, fallback to polling
                fallbackTimer = setTimeout(() => {
                    if (!cancelled) connect();
                }, 2000);
            };
        };

        connect();

        return () => {
            cancelled = true;
            es?.close();
            if (fallbackTimer) clearInterval(fallbackTimer);
        };
    }, []);

    return useMemo(
        () => ({
            loading: !snapshot && !error,
            error,
            snapshot,
        }),
        [error, snapshot]
    );
}

export function sectionPhaseLabel(section: ScoreboardSection, phase: number) {
    const total = section.phases;
    return `Phase ${phase}` + (phase === total ? " (final)" : "");
}
