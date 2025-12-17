"use client";

import { serverTimestamp, setDoc } from "firebase/firestore";

import { gameCueDoc } from "./collections";

export async function setCueActive(
    cueId: string,
    active: boolean,
    payload?: Record<string, unknown>
) {
    const data = {
        active,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        ...(payload !== undefined ? { payload } : {}),
    };
    await setDoc(
        gameCueDoc(cueId),
        data,
        { merge: true }
    );
}
