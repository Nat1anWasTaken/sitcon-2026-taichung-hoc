import { NextResponse } from "next/server";

import { sectionTwoSeedThemes } from "@/lib/game/config";
import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakThemeModel } from "@/lib/models/jailbreak-theme";

export async function POST() {
    await connectToDatabase();
    await JailbreakThemeModel.deleteMany({});

    const now = new Date();
    const themes = sectionTwoSeedThemes.map((theme) => ({
        _id: theme.id,
        id: theme.id,
        title: theme.title,
        description: theme.description,
        difficulty: theme.difficulty,
        adminPrompt: theme.adminPrompt,
        breachCriteria: theme.breachCriteria,
        createdAt: now,
        updatedAt: now,
    }));

    if (themes.length) {
        await JailbreakThemeModel.insertMany(themes);
    }

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
