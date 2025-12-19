import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
    throw new Error("Please define MONGODB_URI environment variable in .env.local");
}

// Cache connection in global to survive hot reloads in Next.js
let cached = global._mongooseGlobal;

if (!cached) {
    cached = global._mongooseGlobal = { conn: null, promise: null };
}

export async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            maxPoolSize: 10, // Limit connections for serverless
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// Type declaration for global
declare global {
    var _mongooseGlobal: {
        conn: typeof import("mongoose") | null;
        promise: Promise<typeof import("mongoose")> | null;
    };
}
