import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IGardenPhase {
    _id: string; // Firestore document ID
    id: string; // Same as _id for compatibility
    title: string;
    mode: "blocks" | "text";
    order: number;
    description?: string;
    lockedByCue?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Define the model type
export type GardenPhaseModelType = Model<IGardenPhase>;

// Create schema
const gardenPhaseSchema = new Schema<IGardenPhase, GardenPhaseModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        title: { type: String, required: true },
        mode: { type: String, enum: ["blocks", "text"], required: true },
        order: { type: Number, required: true },
        description: { type: String },
        lockedByCue: { type: String, default: null },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Create index on order for sorting
gardenPhaseSchema.index({ order: 1 });

// Export model (handle hot reload)
export const GardenPhaseModel =
    (mongoose.models.GardenPhase as GardenPhaseModelType) ||
    mongoose.model<IGardenPhase, GardenPhaseModelType>("GardenPhase", gardenPhaseSchema);
