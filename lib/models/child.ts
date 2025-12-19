import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IChild {
    _id: string; // childId from Firestore
    seatNumber: number;
    childId: string; // short identifier printed on the badge
    passwordSalt: string;
    passwordHash: string; // SHA-256(salt:password)
    name?: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    status?: "active" | "disabled";
}

// Define the model type
export type ChildModelType = Model<IChild>;

// Create schema
const childSchema = new Schema<IChild, ChildModelType>(
    {
        _id: { type: String, required: true },
        seatNumber: { type: Number, required: true, unique: true },
        childId: { type: String, required: true },
        passwordSalt: { type: String, required: true },
        passwordHash: { type: String, required: true },
        name: { type: String, default: null },
        lastLoginAt: { type: Date },
        status: { type: String, enum: ["active", "disabled"], default: "active" },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: true, // Automatically manage createdAt and updatedAt
    }
);

// Create indexes
childSchema.index({ seatNumber: 1 }, { unique: true });
childSchema.index({ childId: 1 });

// Export model (handle hot reload)
export const ChildModel =
    (mongoose.models.Child as ChildModelType) ||
    mongoose.model<IChild, ChildModelType>("Child", childSchema);
