import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IJailbreakTheme {
    _id: string; // Firestore document ID
    id: string; // Same as _id for compatibility
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    adminPrompt: string;
    breachCriteria: string;
    createdAt: Date;
    updatedAt: Date;
}

// Define the model type
export type JailbreakThemeModelType = Model<IJailbreakTheme>;

// Create schema
const jailbreakThemeSchema = new Schema<IJailbreakTheme, JailbreakThemeModelType>(
    {
        _id: { type: String, required: true },
        id: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            required: true,
        },
        adminPrompt: { type: String, required: true },
        breachCriteria: { type: String, required: true },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Create index on difficulty
jailbreakThemeSchema.index({ difficulty: 1 });

// Export model (handle hot reload)
export const JailbreakThemeModel =
    (mongoose.models.JailbreakTheme as JailbreakThemeModelType) ||
    mongoose.model<IJailbreakTheme, JailbreakThemeModelType>("JailbreakTheme", jailbreakThemeSchema);
