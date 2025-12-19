import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IJailbreakMatch {
    _id: string; // Document ID (migrated from Firestore)
    id: string; // Same as _id for compatibility
    attackerChildId: string;
    defenderChildId: string;
    attackerSeat?: number;
    defenderSeat?: number;
    attackerName?: string | null;
    defenderName?: string | null;
    themeId: string;
    themeTitle: string;
    themeDescription: string;
    adminPrompt: string;
    breachCriteria: string;
    developerPrompt: string;
    cracksCompleted: number;
    attackerScore: number;
    defenderScore: number;
    currentPhase: "ATTACK_PHASE" | "DEFENDER_PATCH" | "COMPLETED";
    attemptCount: number;
    status?: "active" | "completed" | "paused";
    phaseExpiresAt?: Date;
    completedThemeIds?: string[];
    createdAt: Date;
    updatedAt: Date;
}

// Define the model type
export type JailbreakMatchModelType = Model<IJailbreakMatch>;

// Create schema
const jailbreakMatchSchema = new Schema<IJailbreakMatch, JailbreakMatchModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        attackerChildId: { type: String, required: true },
        defenderChildId: { type: String, required: true },
        attackerSeat: { type: Number },
        defenderSeat: { type: Number },
        attackerName: { type: String, default: null },
        defenderName: { type: String, default: null },
        themeId: { type: String, required: true },
        themeTitle: { type: String, required: true },
        themeDescription: { type: String, required: true },
        adminPrompt: { type: String, required: true },
        breachCriteria: { type: String, required: true },
        developerPrompt: { type: String, required: true },
        cracksCompleted: { type: Number, default: 0 },
        attackerScore: { type: Number, default: 0 },
        defenderScore: { type: Number, default: 0 },
        currentPhase: {
            type: String,
            enum: ["ATTACK_PHASE", "DEFENDER_PATCH", "COMPLETED"],
            required: true,
        },
        attemptCount: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ["active", "completed", "paused"],
            default: "active",
        },
        phaseExpiresAt: { type: Date },
        completedThemeIds: { type: [String], default: [] },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Create compound indexes for efficient queries
jailbreakMatchSchema.index({ attackerChildId: 1, updatedAt: -1 });
jailbreakMatchSchema.index({ defenderChildId: 1, updatedAt: -1 });
jailbreakMatchSchema.index({ status: 1, updatedAt: -1 });

// Export model (handle hot reload)
export const JailbreakMatchModel =
    (mongoose.models.JailbreakMatch as JailbreakMatchModelType) ||
    mongoose.model<IJailbreakMatch, JailbreakMatchModelType>("JailbreakMatch", jailbreakMatchSchema);
