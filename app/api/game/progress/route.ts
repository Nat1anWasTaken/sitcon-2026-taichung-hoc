import { NextRequest, NextResponse } from "next/server";

import { SectionProgress } from "@/lib/game-types";
import { connectToDatabase } from "@/lib/mongodb";
import { ChildProgressModel, IChildProgress, ISectionProgress } from "@/lib/models/child-progress";

export async function GET(req: NextRequest) {
    const childId = req.nextUrl.searchParams.get("childId") ?? "";
    if (!childId) {
        return NextResponse.json({ error: "childId required" }, { status: 400 });
    }

    try {
      await connectToDatabase();
      const doc = await ChildProgressModel.findById(childId).lean<IChildProgress | null>();
    } catch (error) {
        console.error("Database error fetching progress:", error);
        return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
    }
    const progress: Record<string, SectionProgress> = {};

    const sections = doc?.sections;
    if (sections) {
        if (sections instanceof Map) {
            for (const [sectionId, data] of sections.entries()) {
                const entry = data as ISectionProgress;
                progress[sectionId] = {
                    ...(entry as SectionProgress),
                    sectionId: entry.sectionId ?? sectionId,
                };
            }
        } else {
            const entries = Object.entries(sections as Record<string, ISectionProgress>);
            entries.forEach(([sectionId, data]) => {
                progress[sectionId] = {
                    ...(data as SectionProgress),
                    sectionId: data.sectionId ?? sectionId,
                };
            });
        }
    }

    return NextResponse.json({ progress });
}

export const runtime = "nodejs";
