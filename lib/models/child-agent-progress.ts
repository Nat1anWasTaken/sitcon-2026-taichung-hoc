import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IChildAgentProgress {
    _id: string; // childId
    currentLevelOrder: number;
    waitingCueType?: string | null;
    updatedAt: Date;
    createdAt: Date;
}

// Define the model type
export type ChildAgentProgressModelType = Model<IChildAgentProgress>;

// Create schema
const childAgentProgressSchema = new Schema<IChildAgentProgress, ChildAgentProgressModelType>(
    {
        _id: { type: String, required: true },
        currentLevelOrder: { type: Number, required: true, default: 1 },
        waitingCueType: { type: String, default: null },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Export model (handle hot reload)
export const ChildAgentProgressModel =
    (mongoose.models.ChildAgentProgress as ChildAgentProgressModelType) ||
    mongoose.model<IChildAgentProgress, ChildAgentProgressModelType>(
        "ChildAgentProgress",
        childAgentProgressSchema
    );
