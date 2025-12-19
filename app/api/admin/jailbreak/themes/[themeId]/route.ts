import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakThemeModel } from "@/lib/models/jailbreak-theme";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    const { themeId } = await params;
    if (!themeId) {
        return NextResponse.json({ error: "themeId required" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.title !== "undefined") updates.title = body.title;
    if (typeof body.description !== "undefined") updates.description = body.description;
    if (typeof body.difficulty !== "undefined") updates.difficulty = body.difficulty;
    if (typeof body.adminPrompt !== "undefined") updates.adminPrompt = body.adminPrompt;
    if (typeof body.breachCriteria !== "undefined") updates.breachCriteria = body.breachCriteria;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 1) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await JailbreakThemeModel.updateOne({ _id: themeId }, { $set: updates });
    if (!result.matchedCount) {
        return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
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
