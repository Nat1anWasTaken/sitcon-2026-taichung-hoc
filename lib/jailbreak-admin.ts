"use client";

import { addDoc, deleteDoc, getDoc, getDocs, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";

import {
    childDoc,
    jailbreakMatchDoc,
    jailbreakMatchesCollection,
    jailbreakThemeDoc,
    jailbreakThemesCollection,
    jailbreakTurnsCollection,
} from "./collections";
import { sectionTwoSeedThemes } from "./game/config";
import { JailbreakDifficulty, JailbreakMatch, JailbreakTheme } from "./jailbreak-types";

type CreateThemeInput = {
    title: string;
    description: string;
    difficulty: JailbreakDifficulty;
    adminPrompt: string;
    breachCriteria: string;
};

export async function createJailbreakTheme(input: CreateThemeInput) {
    const payload: Omit<JailbreakTheme, "id"> = {
        ...input,
        createdAt: serverTimestamp() as unknown as JailbreakTheme["createdAt"],
        updatedAt: serverTimestamp() as unknown as JailbreakTheme["updatedAt"],
    };
    await addDoc(jailbreakThemesCollection, payload);
}

export async function updateJailbreakTheme(themeId: string, input: CreateThemeInput) {
    await updateDoc(jailbreakThemeDoc(themeId), {
        ...input,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteJailbreakTheme(themeId: string) {
    await deleteDoc(jailbreakThemeDoc(themeId));
}

type CreateMatchInput = {
    themeId: string;
    attackerChildId: string;
    defenderChildId: string;
};

export async function createJailbreakMatch({
    themeId,
    attackerChildId,
    defenderChildId,
}: CreateMatchInput) {
    const [themeSnap, attackerSnap, defenderSnap] = await Promise.all([
        getDoc(jailbreakThemeDoc(themeId)),
        getDoc(childDoc(attackerChildId)),
        getDoc(childDoc(defenderChildId)),
    ]);

    if (!themeSnap.exists()) throw new Error("Theme not found");
    const theme = themeSnap.data();
    const attacker = attackerSnap.data();
    const defender = defenderSnap.data();

    const now = serverTimestamp() as unknown as JailbreakMatch["createdAt"];
    const payload: Omit<JailbreakMatch, "id"> = {
        attackerChildId,
        defenderChildId,
        attackerSeat: attacker?.seatNumber,
        defenderSeat: defender?.seatNumber,
        attackerName: attacker?.name ?? null,
        defenderName: defender?.name ?? null,
        themeId,
        themeTitle: theme.title,
        themeDescription: theme.description,
        adminPrompt: theme.adminPrompt,
        breachCriteria: theme.breachCriteria,
        developerPrompt: "",
        cracksCompleted: 0,
        attackerScore: 0,
        defenderScore: 0,
        currentPhase: "DEFENDER_PATCH",
        attemptCount: 0,
        status: "active",
        createdAt: now,
        updatedAt: now,
    };

    const ref = await addDoc(jailbreakMatchesCollection, payload);
    return ref.id;
}

export async function resetMatchToTheme(matchId: string, themeId: string) {
    const themeSnap = await getDoc(jailbreakThemeDoc(themeId));
    if (!themeSnap.exists()) throw new Error("Theme not found");
    const theme = themeSnap.data();

    await updateDoc(jailbreakMatchDoc(matchId), {
        themeId,
        themeTitle: theme.title,
        themeDescription: theme.description,
        adminPrompt: theme.adminPrompt,
        breachCriteria: theme.breachCriteria,
        cracksCompleted: 0,
        attackerScore: 0,
        defenderScore: 0,
        developerPrompt: "",
        attemptCount: 0,
        currentPhase: "DEFENDER_PATCH",
        status: "active",
        updatedAt: serverTimestamp(),
    });

    const turns = await getDocs(jailbreakTurnsCollection(matchId));
    await Promise.all(turns.docs.map((d) => deleteDoc(d.ref)));
}

export async function setMatchStatus(matchId: string, status: JailbreakMatch["status"]) {
    await updateDoc(jailbreakMatchDoc(matchId), {
        status,
        updatedAt: serverTimestamp(),
    });
}

export async function resetJailbreakToSeed() {
    const batch = writeBatch(jailbreakThemesCollection.firestore);

    const themesSnap = await getDocs(jailbreakThemesCollection);
    themesSnap.forEach((doc) => batch.delete(doc.ref));

    const timestamp = serverTimestamp();

    sectionTwoSeedThemes.forEach((theme) => {
        batch.set(jailbreakThemeDoc(theme.id), {
            ...theme,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    });

    await batch.commit();
}
