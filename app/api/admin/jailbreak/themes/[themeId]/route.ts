import { NextRequest, NextResponse } from "next/server";
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakThemeModel } from "@/lib/models/jailbreak-theme";
import { AdminModel } from "@/lib/models/admin";

function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
        return initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
        });
    }
    
    // Fallback for environments where GOOGLE_APPLICATION_CREDENTIALS might be set
    // or if we want to fail gracefully (though auth will fail without creds)
    return initializeApp();
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        let uid: string;
        try {
            const app = getAdminApp();
            const decodedToken = await getAuth(app).verifyIdToken(token);
            uid = decodedToken.uid;
        } catch (error) {
            console.error("Token verification failed:", error);
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        await connectToDatabase();
        const admin = await AdminModel.findById(uid);
        if (!admin) {
            return NextResponse.json({ error: "User is not an admin" }, { status: 403 });
        }

        const { themeId } = await params;
        if (!themeId) {
            return NextResponse.json({ error: "themeId required" }, { status: 400 });
        }

        const body = await req.json();
        const updates: Record<string, unknown> = {};

        if (body.title !== undefined) {
            const val = String(body.title).trim();
            if (!val) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
            updates.title = val;
        }

        if (body.description !== undefined) {
            const val = String(body.description).trim();
            if (!val) return NextResponse.json({ error: "description cannot be empty" }, { status: 400 });
            updates.description = val;
        }

        if (body.difficulty !== undefined) {
            if (!["easy", "medium", "hard"].includes(body.difficulty)) {
                return NextResponse.json({ error: "Invalid difficulty value" }, { status: 400 });
            }
            updates.difficulty = body.difficulty;
        }

        if (body.adminPrompt !== undefined) {
            const val = String(body.adminPrompt).trim();
            if (!val) return NextResponse.json({ error: "adminPrompt cannot be empty" }, { status: 400 });
            updates.adminPrompt = val;
        }

        if (body.breachCriteria !== undefined) {
            const val = String(body.breachCriteria).trim();
            if (!val) return NextResponse.json({ error: "breachCriteria cannot be empty" }, { status: 400 });
            updates.breachCriteria = val;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
        }

        updates.updatedAt = new Date();

        const result = await JailbreakThemeModel.updateOne({ _id: themeId }, { $set: updates });
        if (!result.matchedCount) {
            return NextResponse.json({ error: "Theme not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error updating theme:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    const { themeId } = await params;
    if (!themeId) {
        return NextResponse.json({ error: "themeId required" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await JailbreakThemeModel.deleteOne({ _id: themeId });
    if (!result.deletedCount) {
        return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
