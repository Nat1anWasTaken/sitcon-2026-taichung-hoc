import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakMatchModel } from "@/lib/models/jailbreak-match";
import { JailbreakThemeModel, IJailbreakTheme } from "@/lib/models/jailbreak-theme";
import { JailbreakTurnModel } from "@/lib/models/jailbreak-turn";

const TURN_DURATION_MS = 60_000;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    if (!matchId) {
        return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    const body = await req.json();
    const themeId = String(body.themeId ?? "").trim();
    if (!themeId) {
        return NextResponse.json({ error: "themeId required" }, { status: 400 });
    }

    await connectToDatabase();
    const theme = await JailbreakThemeModel.findById(themeId).lean<IJailbreakTheme | null>();
    if (!theme) {
        return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    await JailbreakMatchModel.updateOne(
        { _id: matchId },
        {
            $set: {
                themeId,
                themeTitle: theme.title,
                themeDescription: theme.description,
                adminPrompt: theme.adminPrompt,
                breachCriteria: theme.breachCriteria,
                cracksCompleted: 0,
                attackerScore: 0,
                defenderScore: 0,
                developerPrompt: "",
                attemptCount: 0,
                currentPhase: "DEFENDER_PATCH",
                status: "active",
                completedThemeIds: [],
                phaseExpiresAt: new Date(Date.now() + TURN_DURATION_MS),
                updatedAt: new Date(),
            },
        }
    );

    await JailbreakTurnModel.deleteMany({ matchId });

    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
