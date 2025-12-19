import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { JailbreakMatch } from "@/lib/jailbreak-types";
import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel, IChild } from "@/lib/models/child";
import { JailbreakMatchModel, IJailbreakMatch } from "@/lib/models/jailbreak-match";
import { JailbreakThemeModel, IJailbreakTheme } from "@/lib/models/jailbreak-theme";

const TURN_DURATION_MS = 60_000;

export async function GET() {
    await connectToDatabase();
    const docs = await JailbreakMatchModel.find({}).lean<IJailbreakMatch[]>();
    const matches = docs.map((doc) => {
        const { _id, ...rest } = doc as IJailbreakMatch & { _id?: string };
        const id = rest.id ?? _id ?? "";
        return { ...(rest as unknown as JailbreakMatch), id };
    });

    return NextResponse.json({ matches });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const themeId = String(body.themeId ?? "").trim();
        const attackerChildId = String(body.attackerChildId ?? "").trim();
        const defenderChildId = String(body.defenderChildId ?? "").trim();

        if (!themeId || !attackerChildId || !defenderChildId) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        await connectToDatabase();
        const [theme, attacker, defender] = await Promise.all([
            JailbreakThemeModel.findById(themeId).lean<IJailbreakTheme | null>(),
            ChildModel.findById(attackerChildId).lean<IChild | null>(),
            ChildModel.findById(defenderChildId).lean<IChild | null>(),
        ]);

        if (!theme) {
            return NextResponse.json({ error: "Theme not found" }, { status: 404 });
        }
        if (!attacker || !defender) {
            return NextResponse.json({ error: "Child not found" }, { status: 404 });
        }

        const id = randomUUID();
        const now = new Date();
        const match: IJailbreakMatch = {
            _id: id,
            id,
            attackerChildId,
            defenderChildId,
            attackerSeat: attacker.seatNumber,
            defenderSeat: defender.seatNumber,
            attackerName: attacker.name ?? null,
            defenderName: defender.name ?? null,
            themeId,
            themeTitle: theme.title,
            themeDescription: theme.description,
            adminPrompt: theme.adminPrompt,
            breachCriteria: theme.breachCriteria,
            developerPrompt: "",
            cracksCompleted: 0,
            attackerScore: 0,
            defenderScore: 0,
            currentPhase: "DEFENDER_PATCH",
            attemptCount: 0,
            status: "active",
            completedThemeIds: [],
            phaseExpiresAt: new Date(now.getTime() + TURN_DURATION_MS),
            createdAt: now,
            updatedAt: now,
        };

        await JailbreakMatchModel.create(match);
        return NextResponse.json({ matchId: id }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create match";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
