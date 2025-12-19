import mongoose, { Schema, Model } from "mongoose";

// Interface for section progress
export interface ISectionProgress {
    sectionId: string;
    currentPhase: 1 | 2 | 3;
    currentLevel: number;
    phase1Complete?: boolean;
    phase2Complete?: boolean;
    phase3Complete?: boolean;
    sectionComplete?: boolean;
    lastPrompt?: string;
    lastImageUrl?: string;
    lastTarget?: string;
    lastMatch?: boolean;
    lastFeedback?: string;
    updatedAt: Date;
    cuesConsumed?: Record<string, boolean>;
}

// Interface for the document
export interface IChildProgress {
    _id: string; // childId
    sections: Map<string, ISectionProgress>; // Map of sectionId -> progress
}

// Define the model type
export type ChildProgressModelType = Model<IChildProgress>;

// Create section progress subdocument schema
const sectionProgressSchema = new Schema<ISectionProgress>(
    {
        sectionId: { type: String, required: true },
        currentPhase: { type: Number, enum: [1, 2, 3], required: true },
        currentLevel: { type: Number, required: true },
        phase1Complete: { type: Boolean },
        phase2Complete: { type: Boolean },
        phase3Complete: { type: Boolean },
        sectionComplete: { type: Boolean },
        lastPrompt: { type: String },
        lastImageUrl: { type: String },
        lastTarget: { type: String },
        lastMatch: { type: Boolean },
        lastFeedback: { type: String },
        updatedAt: { type: Date, default: Date.now },
        cuesConsumed: { type: Map, of: Boolean },
    },
    { _id: false }
);

// Create child progress schema
const childProgressSchema = new Schema<IChildProgress, ChildProgressModelType>(
    {
        _id: { type: String, required: true },
        sections: {
            type: Map,
            of: sectionProgressSchema,
            default: new Map(),
        },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false,
    }
);

// Create index on childId
childProgressSchema.index({ _id: 1 });

// Export model (handle hot reload)
export const ChildProgressModel =
    (mongoose.models.ChildProgress as ChildProgressModelType) ||
    mongoose.model<IChildProgress, ChildProgressModelType>("ChildProgress", childProgressSchema);
