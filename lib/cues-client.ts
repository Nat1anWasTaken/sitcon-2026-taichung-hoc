"use client";

import { serverTimestamp, setDoc } from "firebase/firestore";

import { gameCueDoc } from "./collections";

export async function setCueActive(
    cueId: string,
    active: boolean,
    payload?: Record<string, unknown>
) {
    await setDoc(
        gameCueDoc(cueId),
        {
            id: cueId,
            active,
            payload: payload ?? null,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
        },
        { merge: true }
    );
}
