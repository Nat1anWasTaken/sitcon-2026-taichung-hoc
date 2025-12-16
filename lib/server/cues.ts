import { FieldValue } from "firebase-admin/firestore";

import { adminFirestore } from "../firebase-admin";
import { GameCue } from "../game-types";

function assertAdminDb() {
  if (!adminFirestore) throw new Error("Admin Firestore not initialized");
  return adminFirestore;
}

const CUES_COLLECTION = "gameCues";

export async function listActiveCues(): Promise<GameCue[]> {
  const db = assertAdminDb();
  const snap = await db.collection(CUES_COLLECTION).where("active", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as GameCue) }));
}

export async function setCueState(cueId: string, data: Partial<GameCue>) {
  const db = assertAdminDb();
  await db
    .collection(CUES_COLLECTION)
    .doc(cueId)
    .set(
      {
        id: cueId,
        active: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...data,
      },
      { merge: true },
    );
}

export async function getCue(cueId: string): Promise<GameCue | null> {
  const db = assertAdminDb();
  const snap = await db.collection(CUES_COLLECTION).doc(cueId).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as GameCue) } as GameCue) : null;
}
