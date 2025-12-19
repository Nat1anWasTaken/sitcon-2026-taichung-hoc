import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IJailbreakTurn {
    _id: string; // Firestore document ID
    id: string; // Same as _id for compatibility
    matchId: string;
    attackerPrompt: string;
    aiResponse: string;
    breach: boolean;
    refereeReason?: string;
    tokensUsed?: number;
    createdAt: Date;
}

// Define the model type
export type JailbreakTurnModelType = Model<IJailbreakTurn>;

// Create schema
const jailbreakTurnSchema = new Schema<IJailbreakTurn, JailbreakTurnModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        matchId: { type: String, required: true, index: true },
        attackerPrompt: { type: String, required: true },
        aiResponse: { type: String, required: true },
        breach: { type: Boolean, required: true },
        refereeReason: { type: String },
        tokensUsed: { type: Number },
        createdAt: { type: Date, default: Date.now },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false, // We only need createdAt
    }
);

// Create compound index for efficient queries
jailbreakTurnSchema.index({ matchId: 1, createdAt: -1 });

// Export model (handle hot reload)
export const JailbreakTurnModel =
    (mongoose.models.JailbreakTurn as JailbreakTurnModelType) ||
    mongoose.model<IJailbreakTurn, JailbreakTurnModelType>("JailbreakTurn", jailbreakTurnSchema);
