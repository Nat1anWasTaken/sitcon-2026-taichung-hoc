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
import { AdminProfile, ChildAccount } from "./types";

const adminConverter: FirestoreDataConverter<AdminProfile> = {
  toFirestore: (data) => data,
  fromFirestore: (snap) => snap.data() as AdminProfile,
};

const childConverter: FirestoreDataConverter<ChildAccount> = {
  toFirestore: (data) => data,
  fromFirestore: (snap) => snap.data() as ChildAccount,
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
