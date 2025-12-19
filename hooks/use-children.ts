"use client";

import { useMemo } from "react";

import { ChildAccount } from "@/lib/types";
import { usePolling } from "./use-polling";

type ChildrenState = {
    loading: boolean;
    error?: string;
    children: ChildAccount[];
};

export function useChildren(): ChildrenState {
    const { data, loading, error } = usePolling<ChildAccount[]>(
        "/api/admin/children",
        5000,
        {
            select: (payload) => (payload as { children: ChildAccount[] }).children ?? [],
            transform: (children) =>
                [...children].sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0)),
        }
    );

    return {
        loading,
        error,
        children: data ?? [],
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
