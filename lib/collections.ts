import {
    CollectionReference,
    DocumentReference,
    FirestoreDataConverter,
    collection,
    doc,
    query,
    where,
    collectionGroup,
} from "firebase/firestore";

import { firestoreDb } from "./firebase";
import { GameCue, SectionProgress } from "./game-types";
import { AdminProfile, ChildAccount } from "./types";
import { JailbreakMatch, JailbreakTheme, JailbreakTurn } from "./jailbreak-types";

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
    fromFirestore: (snap) => {
<<<<<<< HEAD
        const data = snap.data() as GameCue;
        return { ...data, id: snap.id };
=======
        const rest = snap.data() as GameCue;
        return { ...rest, id: snap.id };
    },
};

const jailbreakThemeConverter: FirestoreDataConverter<JailbreakTheme> = {
    toFirestore: (data) => data,
    fromFirestore: (snap) => {
        const rest = snap.data() as JailbreakTheme;
        return { ...rest, id: snap.id };
    },
};

const jailbreakMatchConverter: FirestoreDataConverter<JailbreakMatch> = {
    toFirestore: (data) => data,
    fromFirestore: (snap) => {
        const rest = snap.data() as JailbreakMatch;
        return { ...rest, id: snap.id };
    },
};

const jailbreakTurnConverter: FirestoreDataConverter<JailbreakTurn> = {
    toFirestore: (data) => data,
    fromFirestore: (snap) => {
        const rest = snap.data() as JailbreakTurn;
        return { ...rest, id: snap.id };
>>>>>>> feat/section-2
    },
};

export const adminCollection = collection(firestoreDb, "admins").withConverter(
    adminConverter
) as CollectionReference<AdminProfile>;

export const childrenCollection = collection(firestoreDb, "children").withConverter(
    childConverter
) as CollectionReference<ChildAccount>;

export const adminDoc = (uid: string) =>
    doc(adminCollection, uid) as DocumentReference<AdminProfile>;

export const childDoc = (childId: string) =>
    doc(childrenCollection, childId) as DocumentReference<ChildAccount>;

export const childBySeatQuery = (seatNumber: number) =>
    query(childrenCollection, where("seatNumber", "==", seatNumber));

export const sectionProgressCollection = (childId: string) =>
    collection(firestoreDb, "childProgress", childId, "sections").withConverter(
        progressConverter
    ) as CollectionReference<SectionProgress>;

export const sectionProgressDoc = (childId: string, sectionId: string) =>
    doc(sectionProgressCollection(childId), sectionId) as DocumentReference<SectionProgress>;

export const gameCuesCollection = collection(firestoreDb, "gameCues").withConverter(
    cueConverter
) as CollectionReference<GameCue>;

export const gameCueDoc = (cueId: string) =>
    doc(gameCuesCollection, cueId) as DocumentReference<GameCue>;

export const jailbreakThemesCollection = collection(
    firestoreDb,
    "jailbreakThemes"
).withConverter(jailbreakThemeConverter) as CollectionReference<JailbreakTheme>;

export const jailbreakThemeDoc = (themeId: string) =>
    doc(jailbreakThemesCollection, themeId) as DocumentReference<JailbreakTheme>;

export const jailbreakMatchesCollection = collection(
    firestoreDb,
    "jailbreakMatches"
).withConverter(jailbreakMatchConverter) as CollectionReference<JailbreakMatch>;

export const jailbreakMatchDoc = (matchId: string) =>
    doc(jailbreakMatchesCollection, matchId) as DocumentReference<JailbreakMatch>;

export const jailbreakTurnsCollection = (matchId: string) =>
    collection(firestoreDb, "jailbreakMatches", matchId, "turns").withConverter(
        jailbreakTurnConverter
    ) as CollectionReference<JailbreakTurn>;

export const jailbreakTurnsGroup = collectionGroup(
    firestoreDb,
    "turns"
).withConverter(jailbreakTurnConverter);
