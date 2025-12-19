import { SECTION_ONE_ID, SectionConfig, buildSectionConfigFromRecords } from "../game/config";
import { connectToDatabase } from "../mongodb";
import { GardenPhaseModel, IGardenPhase } from "../models/garden-phase";
import { GardenLevelModel, IGardenLevel } from "../models/garden-level";

const SECTION_ONE_TITLE = "Garden Builders";

export async function fetchSectionOneConfig(): Promise<{
    config: SectionConfig;
    source: "mongodb";
}> {
    await connectToDatabase();

    const [phasesDocs, levelsDocs] = await Promise.all([
        GardenPhaseModel.find({}).sort({ order: 1 }).lean<IGardenPhase[]>(),
        GardenLevelModel.find({}).sort({ levelNumber: 1 }).lean<IGardenLevel[]>(),
    ]);

    const phases = phasesDocs.map((data) => {
        const id = data.id ?? data._id;
        const lockedByCue =
            data.lockedByCue ||
            (id === "phase-2" ? "start-phase-2" : id === "phase-3" ? "start-phase-3" : undefined);
        return {
            id,
            title: data.title,
            mode: data.mode ?? "blocks",
            description: data.description || undefined,
            lockedByCue,
            order: Number(data.order ?? 0),
        };
    });

    const levels = levelsDocs.map((data) => {
        const id = data.id ?? data._id;
        return {
            id,
            phaseId: data.phaseId || "",
            levelNumber: Number(data.levelNumber ?? 0),
            target: data.target || "",
            blocks: Array.isArray(data.blocks) ? data.blocks : undefined,
            bonusBlocks: Array.isArray(data.bonusBlocks)
                ? data.bonusBlocks
                : undefined,
            hint: data.hint || undefined,
        };
    });

    if (!phases.length || !levels.length) {
        throw new Error(
            "Section 1 configuration is missing in MongoDB. Please add gardenPhases and gardenLevels records."
        );
    }

    const config = buildSectionConfigFromRecords(SECTION_ONE_ID, SECTION_ONE_TITLE, phases, levels);
    return { config, source: "mongodb" };
}
