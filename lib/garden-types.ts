import { GardenLevelRecord, GardenPhaseRecord } from "./game/config";

export type GardenPhase = GardenPhaseRecord & {
    createdAt: Date | string;
    updatedAt: Date | string;
};

export type GardenLevel = GardenLevelRecord & {
    createdAt: Date | string;
    updatedAt: Date | string;
};
