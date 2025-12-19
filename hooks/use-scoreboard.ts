"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ScoreboardSection, ScoreboardSnapshot } from "@/lib/scoreboard-types";
import { AgentScoreboardRow } from "@/lib/agent-types";
import { JailbreakScoreboardRow } from "@/lib/jailbreak-scoreboard-types";
import { fetchJson, getErrorMessage } from "@/lib/query-utils";

export type CombinedScoreboards = {
    garden: ScoreboardSnapshot;
    jailbreak: { generatedAt: string; rows: JailbreakScoreboardRow[] };
    agent: { generatedAt: string; rows: AgentScoreboardRow[] };
};

export type ScoreboardState = {
    loading: boolean;
    error?: string;
    snapshot: CombinedScoreboards | null;
};

const FALLBACK_POLL_MS = 6000;

export function useScoreboard(): ScoreboardState {
    const queryClient = useQueryClient();
    const [streamError, setStreamError] = useState<string | undefined>();
    const query = useQuery({
        queryKey: ["scoreboard"],
        queryFn: () => fetchJson<CombinedScoreboards>("/api/scoreboard?mode=json"),
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        let es: EventSource | null = null;
        let fallbackTimer: ReturnType<typeof setInterval> | null = null;
        let cancelled = false;
        const fetchOnce = async () => {
            try {
                const result = await query.refetch();
                if (!cancelled && result.data) {
                    setStreamError(undefined);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setStreamError(getErrorMessage(err, "Unable to load scoreboard"));
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
                const data = JSON.parse(event.data) as CombinedScoreboards;
                queryClient.setQueryData(["scoreboard"], data);
                setStreamError(undefined);
            };
            es.onerror = () => {
                setStreamError("Live connection lost. Reconnecting…");
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
    }, [query.refetch, queryClient]);

    const error =
        streamError ??
        (query.error ? getErrorMessage(query.error, "Unable to load scoreboard") : undefined);

    return useMemo(
        () => ({
            loading: !query.data && !error,
            error,
            snapshot: query.data ?? null,
        }),
        [error, query.data]
    );
}

export function sectionPhaseLabel(section: ScoreboardSection, phase: number) {
    const total = section.phases;
    return `Phase ${phase}` + (phase === total ? " (final)" : "");
}
