import mongoose, { Schema, Model } from "mongoose";

// Interface for usage data
export interface IAgentRunUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

// Interface for the document
export interface IAgentRun {
    _id: string; // Document ID (migrated from Firestore)
    id: string; // Same as _id for compatibility
    childId: string;
    levelId: string;
    stageType: "HALLUCINATION" | "TOOLS" | "DEFENSE";
    startedAt: Date;
    finishedAt?: Date;
    passed: boolean;
    finalAnswer?: string;
    finalAnswerJson?: Record<string, unknown> | null;
    usage?: IAgentRunUsage;
    steps: number;
    toolCallsCount: number;
    bestForLevel?: boolean;
    failureReason?:
        | "NO_TOOL_USED"
        | "WRONG_FORMAT"
        | "WRONG_ANSWER"
        | "MAX_STEPS"
        | "SCOPE_VIOLATION"
        | "RUNTIME_ERROR"
        | string
        | null;
}

// Define the model type
export type AgentRunModelType = Model<IAgentRun>;

// Create usage subdocument schema
const agentRunUsageSchema = new Schema<IAgentRunUsage>(
    {
        inputTokens: { type: Number },
        outputTokens: { type: Number },
        totalTokens: { type: Number },
    },
    { _id: false }
);

// Create schema
const agentRunSchema = new Schema<IAgentRun, AgentRunModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        childId: { type: String, required: true },
        levelId: { type: String, required: true },
        stageType: {
            type: String,
            enum: ["HALLUCINATION", "TOOLS", "DEFENSE"],
            required: true,
        },
        startedAt: { type: Date, required: true },
        finishedAt: { type: Date },
        passed: { type: Boolean, required: true },
        finalAnswer: { type: String },
        finalAnswerJson: { type: Schema.Types.Mixed, default: null },
        usage: { type: agentRunUsageSchema },
        steps: { type: Number, required: true },
        toolCallsCount: { type: Number, required: true },
        bestForLevel: { type: Boolean },
        failureReason: { type: String, default: null },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false,
    }
);

// Create indexes for efficient queries
agentRunSchema.index({ childId: 1 });
agentRunSchema.index({ levelId: 1, passed: 1 });
agentRunSchema.index({ levelId: 1, bestForLevel: 1 });

// Export model (handle hot reload)
export const AgentRunModel =
    (mongoose.models.AgentRun as AgentRunModelType) ||
    mongoose.model<IAgentRun, AgentRunModelType>("AgentRun", agentRunSchema);
