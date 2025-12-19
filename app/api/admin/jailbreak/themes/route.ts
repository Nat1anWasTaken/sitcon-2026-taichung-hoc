import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { JailbreakTheme } from "@/lib/jailbreak-types";
import { connectToDatabase } from "@/lib/mongodb";
import { JailbreakThemeModel, IJailbreakTheme } from "@/lib/models/jailbreak-theme";

export async function GET() {
    await connectToDatabase();
    const docs = await JailbreakThemeModel.find({}).lean<IJailbreakTheme[]>();
    const themes = docs.map((doc) => {
        const { _id, ...rest } = doc as IJailbreakTheme & { _id?: string };
        const id = rest.id ?? _id ?? "";
        return { ...(rest as unknown as JailbreakTheme), id };
    });

    return NextResponse.json({ themes });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const title = String(body.title ?? "").trim();
        const description = String(body.description ?? "").trim();
        const difficulty = body.difficulty;
        
        if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
            return NextResponse.json({ error: "Invalid difficulty level" }, { status: 400 });
        }
        
        const adminPrompt = String(body.adminPrompt ?? "").trim();
        const breachCriteria = String(body.breachCriteria ?? "").trim();

        if (!title || !description || !adminPrompt || !breachCriteria) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const id = randomUUID();
        await connectToDatabase();
        await JailbreakThemeModel.create({
            _id: id,
            id,
            title,
            description,
            difficulty,
            adminPrompt,
            breachCriteria,
        });

        return NextResponse.json({ id }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create theme";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
