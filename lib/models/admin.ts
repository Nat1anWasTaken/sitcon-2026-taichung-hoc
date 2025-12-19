import mongoose, { Schema, Model } from "mongoose";

// Interface for the document
export interface IAdmin {
    _id: string; // Firebase UID
    email: string;
    role: "admin";
    createdAt: Date;
}

// Define the model type
export type AdminModelType = Model<IAdmin>;

// Create schema
const adminSchema = new Schema<IAdmin, AdminModelType>(
    {
        _id: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        role: { type: String, enum: ["admin"], default: "admin" },
        createdAt: { type: Date, default: Date.now },
    },
    {
        _id: false, // Disable auto ObjectId
        timestamps: false, // We'll manage createdAt manually
    }
);

// Create index on email for fast lookups
adminSchema.index({ email: 1 });

// Export model (handle hot reload)
export const AdminModel =
    (mongoose.models.Admin as AdminModelType) ||
    mongoose.model<IAdmin, AdminModelType>("Admin", adminSchema);
