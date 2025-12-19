import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IGameCue {
    _id: string; // Firestore document ID
    id: string; // Same as _id for compatibility
    type: string; // "start-phase-3" | "unlock-blocks" | "note" | string
    active: boolean;
    payload?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

// Define the model type
export type GameCueModelType = Model<IGameCue>;

// Create schema
const gameCueSchema = new Schema<IGameCue, GameCueModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        type: { type: String, required: true },
        active: { type: Boolean, required: true, default: false },
        payload: { type: Map, of: Schema.Types.Mixed },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Create indexes
gameCueSchema.index({ active: 1, updatedAt: -1 });
gameCueSchema.index({ type: 1 });

// Export model (handle hot reload)
export const GameCueModel =
    (mongoose.models.GameCue as GameCueModelType) ||
    mongoose.model<IGameCue, GameCueModelType>("GameCue", gameCueSchema);
