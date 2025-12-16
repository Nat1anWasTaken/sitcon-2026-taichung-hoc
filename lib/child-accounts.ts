'use client';

import { getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { childBySeatQuery, childDoc, childrenCollection } from "./collections";
import { ChildAccount } from "./types";

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return toHex(bytes.buffer);
}

export async function hashPassword(password: string, salt: string) {
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}

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
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
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
  status: Exclude<ChildAccount["status"], undefined>,
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
