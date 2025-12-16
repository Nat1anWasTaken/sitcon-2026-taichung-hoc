import {
  CollectionReference,
  DocumentReference,
  FirestoreDataConverter,
  collection,
  doc,
  query,
  where,
} from "firebase/firestore";

import { firestoreDb } from "./firebase";
import { GameCue, SectionProgress } from "./game-types";
import { AdminProfile, ChildAccount } from "./types";

const adminConverter: FirestoreDataConverter<AdminProfile> = {
  toFirestore: (data) => data,
  fromFirestore: (snap) => snap.data() as AdminProfile,
};

const childConverter: FirestoreDataConverter<ChildAccount> = {
  toFirestore: (data) => data,
  fromFirestore: (snap) => snap.data() as ChildAccount,
};

const progressConverter: FirestoreDataConverter<SectionProgress> = {
  toFirestore: (data) => data,
  fromFirestore: (snap) => snap.data() as SectionProgress,
};

const cueConverter: FirestoreDataConverter<GameCue> = {
  toFirestore: (data) => data,
  fromFirestore: (snap) => ({ id: snap.id, ...(snap.data() as GameCue) }),
};

export const adminCollection = collection(
  firestoreDb,
  "admins",
).withConverter(adminConverter) as CollectionReference<AdminProfile>;

export const childrenCollection = collection(
  firestoreDb,
  "children",
).withConverter(childConverter) as CollectionReference<ChildAccount>;

export const adminDoc = (uid: string) =>
  doc(adminCollection, uid) as DocumentReference<AdminProfile>;

export const childDoc = (childId: string) =>
  doc(childrenCollection, childId) as DocumentReference<ChildAccount>;

export const childBySeatQuery = (seatNumber: number) =>
  query(childrenCollection, where("seatNumber", "==", seatNumber));

export const sectionProgressCollection = (childId: string) =>
  collection(firestoreDb, "childProgress", childId, "sections").withConverter(
    progressConverter,
  ) as CollectionReference<SectionProgress>;

export const sectionProgressDoc = (childId: string, sectionId: string) =>
  doc(sectionProgressCollection(childId), sectionId) as DocumentReference<SectionProgress>;

export const gameCuesCollection = collection(
  firestoreDb,
  "gameCues",
).withConverter(cueConverter) as CollectionReference<GameCue>;

export const gameCueDoc = (cueId: string) =>
  doc(gameCuesCollection, cueId) as DocumentReference<GameCue>;
