import { Timestamp } from "firebase/firestore";

import { GardenLevelRecord, GardenPhaseRecord } from "./game/config";

export type GardenPhase = GardenPhaseRecord & {
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type GardenLevel = GardenLevelRecord & {
    createdAt: Timestamp;
    updatedAt: Timestamp;
};
