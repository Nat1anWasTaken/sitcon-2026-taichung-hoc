import { adminFirestore } from "../firebase-admin";
import {
    SECTION_ONE_ID,
    SectionConfig,
    buildSectionConfigFromRecords,
    sectionOneSeed,
    sectionOneSeedLevels,
    sectionOneSeedPhases,
} from "../game/config";

function assertAdminDb() {
    if (!adminFirestore) throw new Error("Admin Firestore not initialized");
    return adminFirestore;
}

export async function fetchSectionOneConfig(): Promise<{ config: SectionConfig; source: "firestore" | "seed" }> {
    const db = assertAdminDb();

    const [phasesSnap, levelsSnap] = await Promise.all([
        db.collection("gardenPhases").orderBy("order", "asc").get(),
        db.collection("gardenLevels").orderBy("levelNumber", "asc").get(),
    ]);

    const phases = phasesSnap.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title as string,
            mode: (data.mode as "blocks" | "text") ?? "blocks",
            description: (data.description as string) || undefined,
            lockedByCue: (data.lockedByCue as string | null) || undefined,
            order: Number(data.order ?? 0),
        };
    });

    const levels = levelsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            phaseId: (data.phaseId as string) || "",
            levelNumber: Number(data.levelNumber ?? 0),
            target: (data.target as string) || "",
            blocks: Array.isArray(data.blocks) ? (data.blocks as string[]) : undefined,
            bonusBlocks: Array.isArray(data.bonusBlocks)
                ? (data.bonusBlocks as string[])
                : undefined,
            hint: (data.hint as string) || undefined,
        };
    });

    if (!phases.length || !levels.length) {
        return { config: sectionOneSeed, source: "seed" };
    }

    const config = buildSectionConfigFromRecords(SECTION_ONE_ID, sectionOneSeed.title, phases, levels);
    return { config, source: "firestore" };
}

export async function getSectionOneDefaults() {
    return buildSectionConfigFromRecords(SECTION_ONE_ID, sectionOneSeed.title, sectionOneSeedPhases, sectionOneSeedLevels);
}
