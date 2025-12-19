import mongoose, { Schema, Model } from "mongoose";

// Interface for expected data
export interface IAgentLevelExpected {
    judgeType: "EXACT" | "JSON_SCHEMA" | "REFEREE_LLM";
    canonicalAnswer?: unknown;
    jsonSchema?: unknown;
    refereeCriteria?: string;
}

// Interface for the document
export interface IAgentLevel {
    _id: string; // Document ID (migrated from Firestore)
    id: string; // Same as _id for compatibility
    stageType: "HALLUCINATION" | "TOOLS" | "DEFENSE";
    order: number;
    briefing: string;
    taskPrompt: string;
    allowedTools: string[];
    toolScopes?: Record<string, Record<string, unknown>>;
    expected: IAgentLevelExpected;
    maxSteps?: number;
    isActive: boolean;
    teachingNotes?: string;
    requiresCueAfterPass?: boolean;
    postPassCueType?: string;
}

// Define the model type
export type AgentLevelModelType = Model<IAgentLevel>;

// Create expected subdocument schema
const agentLevelExpectedSchema = new Schema<IAgentLevelExpected>(
    {
        judgeType: {
            type: String,
            enum: ["EXACT", "JSON_SCHEMA", "REFEREE_LLM"],
            required: true,
        },
        canonicalAnswer: { type: Schema.Types.Mixed },
        jsonSchema: { type: Schema.Types.Mixed },
        refereeCriteria: { type: String },
    },
    { _id: false }
);

// Create schema
const agentLevelSchema = new Schema<IAgentLevel, AgentLevelModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        stageType: {
            type: String,
            enum: ["HALLUCINATION", "TOOLS", "DEFENSE"],
            required: true,
        },
        order: { type: Number, required: true },
        briefing: { type: String, required: true },
        taskPrompt: { type: String, required: true },
        allowedTools: { type: [String], required: true },
        toolScopes: { type: Schema.Types.Mixed },
        expected: { type: agentLevelExpectedSchema, required: true },
        maxSteps: { type: Number },
        isActive: { type: Boolean, required: true, default: true },
        teachingNotes: { type: String },
        requiresCueAfterPass: { type: Boolean },
        postPassCueType: { type: String },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false,
    }
);

// Create compound index for efficient queries
agentLevelSchema.index({ stageType: 1, isActive: 1, order: 1 });

// Export model (handle hot reload)
export const AgentLevelModel =
    (mongoose.models.AgentLevel as AgentLevelModelType) ||
    mongoose.model<IAgentLevel, AgentLevelModelType>("AgentLevel", agentLevelSchema);
