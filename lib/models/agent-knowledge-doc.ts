import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IAgentKnowledgeDoc {
    _id: string; // Firestore document ID
    id: string; // Same as _id for compatibility
    entityKey: string;
    sourceTitle: string;
    sourceTier: "trusted" | "untrusted";
    publishedAt: Date;
    supersedesDocId?: string | null;
    content: string;
    facts?: Record<string, unknown> | null;
}

// Define the model type
export type AgentKnowledgeDocModelType = Model<IAgentKnowledgeDoc>;

// Create schema
const agentKnowledgeDocSchema = new Schema<IAgentKnowledgeDoc, AgentKnowledgeDocModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        entityKey: { type: String, required: true },
        sourceTitle: { type: String, required: true },
        sourceTier: {
            type: String,
            enum: ["trusted", "untrusted"],
            required: true,
        },
        publishedAt: { type: Date, required: true },
        supersedesDocId: { type: String, default: null },
        content: { type: String, required: true },
        facts: { type: Map, of: Schema.Types.Mixed, default: null },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false,
    }
);

// Create indexes
agentKnowledgeDocSchema.index({ entityKey: 1 });
agentKnowledgeDocSchema.index({ sourceTier: 1 });
agentKnowledgeDocSchema.index({ publishedAt: -1 });

// Export model (handle hot reload)
export const AgentKnowledgeDocModel =
    (mongoose.models.AgentKnowledgeDoc as AgentKnowledgeDocModelType) ||
    mongoose.model<IAgentKnowledgeDoc, AgentKnowledgeDocModelType>(
        "AgentKnowledgeDoc",
        agentKnowledgeDocSchema
    );
