'use client';

import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase";

export async function signInAdmin(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutAdmin() {
  return signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
