"use client";

import { getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { childBySeatQuery, childDoc } from "./collections";
import { hashPassword, generateSalt } from "./passwords";
import { ChildAccount } from "./types";

type CreateChildInput = {
    childId: string;
    seatNumber: number;
    password: string;
    name?: string;
};

export async function createChildAccount({
    childId,
    seatNumber,
    password,
    name,
}: CreateChildInput) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const payload: Omit<ChildAccount, "lastLoginAt"> = {
        childId,
        seatNumber,
        passwordSalt: salt,
        passwordHash,
        name: name ?? null,
        createdAt: serverTimestamp() as unknown as ChildAccount["createdAt"],
        updatedAt: serverTimestamp() as unknown as ChildAccount["updatedAt"],
        status: "active",
    };

    await setDoc(childDoc(childId), payload);
    return payload;
}

export async function updateChildName(childId: string, name: string) {
    await updateDoc(childDoc(childId), {
        name,
        updatedAt: serverTimestamp(),
    });
}

export async function resetChildPassword(childId: string, password: string) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    await updateDoc(childDoc(childId), {
        passwordSalt: salt,
        passwordHash,
        updatedAt: serverTimestamp(),
    });
}

export async function setChildStatus(
    childId: string,
    status: Exclude<ChildAccount["status"], undefined>
) {
    await updateDoc(childDoc(childId), {
        status,
        updatedAt: serverTimestamp(),
    });
}

export async function verifyChildPassword(childId: string, password: string) {
    const snap = await getDoc(childDoc(childId));
    if (!snap.exists()) return false;
    const data = snap.data();
    const hash = await hashPassword(password, data.passwordSalt);
    return hash === data.passwordHash;
}

export async function childBySeat(seatNumber: number) {
    const qSnap = await getDocs(childBySeatQuery(seatNumber));
    return qSnap.docs[0]?.data() ?? null;
}
