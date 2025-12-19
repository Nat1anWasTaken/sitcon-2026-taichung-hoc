"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ChildAccount } from "@/lib/types";
import { fetchJson, getErrorMessage } from "@/lib/query-utils";

type ChildrenState = {
    loading: boolean;
    error?: string;
    children: ChildAccount[];
    refresh: () => Promise<void>;
};

export function useChildren(): ChildrenState {
    const query = useQuery({
        queryKey: ["admin", "children"],
        queryFn: () => fetchJson<{ children: ChildAccount[] }>("/api/admin/children"),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        select: (payload) =>
            [...(payload.children ?? [])].sort(
                (a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0)
            ),
    });

    return {
        loading: query.isPending,
        error: query.error
            ? getErrorMessage(query.error, "Failed to load children")
            : undefined,
        children: query.data ?? [],
        refresh: () => query.refetch().then(() => undefined),
    };
}

export function useChildStats(children: ChildAccount[]) {
    return useMemo(() => {
        const total = children.length;
        const active = children.filter((c) => c.status !== "disabled").length;
        const disabled = children.filter((c) => c.status === "disabled").length;
        return { total, active, disabled };
    }, [children]);
}
