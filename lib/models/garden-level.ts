import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IGardenLevel {
    _id: string; // Document ID (migrated from Firestore)
    id: string; // Same as _id for compatibility
    phaseId: string;
    levelNumber: number;
    target: string;
    blocks?: string[];
    bonusBlocks?: string[];
    hint?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Define the model type
export type GardenLevelModelType = Model<IGardenLevel>;

// Create schema
const gardenLevelSchema = new Schema<IGardenLevel, GardenLevelModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        phaseId: { type: String, required: true },
        levelNumber: { type: Number, required: true },
        target: { type: String, required: true },
        blocks: { type: [String], default: [] },
        bonusBlocks: { type: [String], default: [] },
        hint: { type: String },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Create compound index for phaseId and levelNumber
gardenLevelSchema.index({ phaseId: 1, levelNumber: 1 });

// Export model (handle hot reload)
export const GardenLevelModel =
    (mongoose.models.GardenLevel as GardenLevelModelType) ||
    mongoose.model<IGardenLevel, GardenLevelModelType>("GardenLevel", gardenLevelSchema);
