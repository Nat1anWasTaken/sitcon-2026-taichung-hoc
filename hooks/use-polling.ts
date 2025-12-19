"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Timestamp } from "firebase/firestore";

type PollingOptions<T> = {
    enabled?: boolean;
    intervalMs?: number;
    revalidateOnFocus?: boolean;
    credentials?: RequestCredentials;
    select?: (payload: unknown) => T;
    transform?: (data: T) => T;
};

type PollingState<T> = {
    data: T | null;
    loading: boolean;
    error?: string;
    refetch: () => Promise<void>;
};

const isTimestampShape = (value: Record<string, unknown>) =>
    typeof value._seconds === "number" && typeof value._nanoseconds === "number";

function reviveFirestoreTimestamps<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((entry) => reviveFirestoreTimestamps(entry)) as T;
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (isTimestampShape(record)) {
            const millis = record._seconds * 1000 + record._nanoseconds / 1_000_000;
            return Timestamp.fromMillis(millis) as T;
        }

        const next: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(record)) {
            next[key] = reviveFirestoreTimestamps(entry);
        }
        return next as T;
    }

    return value;
}

export function usePolling<T>(
    url: string,
    intervalMs: number,
    options: PollingOptions<T> = {}
): PollingState<T> {
    const {
        enabled = true,
        revalidateOnFocus = true,
        credentials = "include",
        select,
        transform,
    } = options;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>(undefined);
    const abortRef = useRef<AbortController | null>(null);
    const intervalRef = useRef<number | null>(null);
    const hasDataRef = useRef(false);
    const selectRef = useRef<((payload: unknown) => T) | undefined>(select);
    const transformRef = useRef<((data: T) => T) | undefined>(transform);

    useEffect(() => {
        selectRef.current = select;
        transformRef.current = transform;
    }, [select, transform]);

    const fetchData = useCallback(async () => {
        if (!enabled) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setError(undefined);
        if (!hasDataRef.current) {
            setLoading(true);
        }

        try {
            const res = await fetch(url, {
                credentials,
                signal: controller.signal,
                cache: "no-store",
            });
            if (!res.ok) {
                throw new Error(`Request failed (${res.status})`);
            }
            const payload = (await res.json()) as unknown;
            const selected = selectRef.current ? selectRef.current(payload) : (payload as T);
            const revived = reviveFirestoreTimestamps(selected);
            const next = transformRef.current ? transformRef.current(revived) : revived;
            setData(next);
            hasDataRef.current = true;
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                setError(err instanceof Error ? err.message : "Failed to load data");
            }
        } finally {
            setLoading(false);
        }
    }, [credentials, enabled, url]);

    useEffect(() => {
        if (!enabled) return;
        fetchData();
        intervalRef.current = window.setInterval(fetchData, intervalMs);

        return () => {
            abortRef.current?.abort();
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
            }
        };
    }, [enabled, fetchData, intervalMs]);

    useEffect(() => {
        if (!enabled || !revalidateOnFocus) return;
        const handleFocus = () => void fetchData();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [enabled, fetchData, revalidateOnFocus]);

    return useMemo(
        () => ({ data, loading, error, refetch: fetchData }),
        [data, error, fetchData, loading]
    );
}
