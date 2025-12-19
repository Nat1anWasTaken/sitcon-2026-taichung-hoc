import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IAgentStage {
    _id: string; // Document ID (migrated from Firestore)
    id: string; // Same as _id for compatibility
    stageType: "HALLUCINATION" | "TOOLS" | "DEFENSE";
    title: string;
    description?: string;
    order: number;
    requiresCueToUnlock?: boolean;
    unlockCueType?: string;
    isActive: boolean;
}

// Define the model type
export type AgentStageModelType = Model<IAgentStage>;

// Create schema
const agentStageSchema = new Schema<IAgentStage, AgentStageModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        stageType: {
            type: String,
            enum: ["HALLUCINATION", "TOOLS", "DEFENSE"],
            required: true,
        },
        title: { type: String, required: true },
        description: { type: String },
        order: { type: Number, required: true },
        requiresCueToUnlock: { type: Boolean },
        unlockCueType: { type: String },
        isActive: { type: Boolean, required: true, default: true },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false,
    }
);

// Create index on stageType and order
agentStageSchema.index({ stageType: 1, order: 1 });
agentStageSchema.index({ isActive: 1 });

// Export model (handle hot reload)
export const AgentStageModel =
    (mongoose.models.AgentStage as AgentStageModelType) ||
    mongoose.model<IAgentStage, AgentStageModelType>("AgentStage", agentStageSchema);
