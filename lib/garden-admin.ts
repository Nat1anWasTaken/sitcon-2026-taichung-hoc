"use client";

import {
    addDoc,
    deleteDoc,
    getDocs,
    serverTimestamp,
    updateDoc,
    writeBatch,
} from "firebase/firestore";

import {
    gardenLevelDoc,
    gardenLevelsByPhase,
    gardenLevelsCollection,
    gardenPhaseDoc,
    gardenPhasesCollection,
} from "./collections";
import { sectionOneSeedLevels, sectionOneSeedPhases } from "./game/config";

type PhaseInput = {
    title: string;
    mode: "blocks" | "text";
    description?: string;
    order: number;
    lockedByCue?: string;
};

export async function createGardenPhase(input: PhaseInput) {
    const payload = {
        ...input,
        lockedByCue: input.lockedByCue || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    await addDoc(gardenPhasesCollection, payload);
}

export async function updateGardenPhase(phaseId: string, input: PhaseInput) {
    await updateDoc(gardenPhaseDoc(phaseId), {
        ...input,
        lockedByCue: input.lockedByCue || null,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteGardenPhase(phaseId: string) {
    const batch = writeBatch(gardenPhasesCollection.firestore);
    batch.delete(gardenPhaseDoc(phaseId));

    const levels = await getDocs(gardenLevelsByPhase(phaseId));
    levels.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
}

type LevelInput = {
    phaseId: string;
    levelNumber: number;
    target: string;
    blocks?: string[];
    bonusBlocks?: string[];
    hint?: string;
};

export async function createGardenLevel(input: LevelInput) {
    const payload = {
        ...input,
        blocks: input.blocks?.filter(Boolean) ?? [],
        bonusBlocks: input.bonusBlocks?.filter(Boolean) ?? [],
        hint: input.hint ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    await addDoc(gardenLevelsCollection, payload);
}

export async function updateGardenLevel(levelId: string, input: LevelInput) {
    await updateDoc(gardenLevelDoc(levelId), {
        ...input,
        blocks: input.blocks?.filter(Boolean) ?? [],
        bonusBlocks: input.bonusBlocks?.filter(Boolean) ?? [],
        hint: input.hint ?? "",
        updatedAt: serverTimestamp(),
    });
}

export async function deleteGardenLevel(levelId: string) {
    await deleteDoc(gardenLevelDoc(levelId));
}

export async function resetGardenToSeed() {
    const batch = writeBatch(gardenPhasesCollection.firestore);

    const [phasesSnap, levelsSnap] = await Promise.all([
        getDocs(gardenPhasesCollection),
        getDocs(gardenLevelsCollection),
    ]);

    phasesSnap.forEach((doc) => batch.delete(doc.ref));
    levelsSnap.forEach((doc) => batch.delete(doc.ref));

    const timestamp = serverTimestamp();

    sectionOneSeedPhases.forEach((phase) => {
        batch.set(gardenPhaseDoc(phase.id), {
            ...phase,
            lockedByCue: phase.lockedByCue || null,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    });

    sectionOneSeedLevels.forEach((level) => {
        batch.set(gardenLevelDoc(level.id), {
            ...level,
            blocks: level.blocks ?? [],
            bonusBlocks: level.bonusBlocks ?? [],
            hint: level.hint ?? "",
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    });

    await batch.commit();
}
