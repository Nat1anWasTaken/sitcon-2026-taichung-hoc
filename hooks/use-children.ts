"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";

import { childrenCollection } from "@/lib/collections";
import { ChildAccount } from "@/lib/types";

type ChildrenState = {
    loading: boolean;
    error?: string;
    children: ChildAccount[];
};

export function useChildren(): ChildrenState {
    const [state, setState] = useState<ChildrenState>({
        loading: true,
        children: [],
    });

    useEffect(() => {
        const q = query(childrenCollection, orderBy("seatNumber", "asc"));
        const unsubscribe = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map((d) => d.data());
                setState({ loading: false, children: data });
            },
            (err) => {
                setState((prev) => ({ ...prev, loading: false, error: err.message }));
            }
        );

        return () => unsubscribe();
    }, []);

    return state;
}

export function useChildStats(children: ChildAccount[]) {
    return useMemo(() => {
        const total = children.length;
        const active = children.filter((c) => c.status !== "disabled").length;
        const disabled = children.filter((c) => c.status === "disabled").length;
        return { total, active, disabled };
    }, [children]);
}
