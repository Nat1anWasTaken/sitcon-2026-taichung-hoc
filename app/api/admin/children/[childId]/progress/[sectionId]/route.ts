import { NextRequest, NextResponse } from "next/server";

import { saveSectionProgress } from "@/lib/server/progress";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ childId: string; sectionId: string }> }
) {
    try {
        const { childId, sectionId } = await params;
        if (!childId || !sectionId) {
            return NextResponse.json(
                { error: "childId and sectionId required" },
                { status: 400 }
            );
        }
        const body = await req.json();
        await saveSectionProgress(childId, sectionId, body);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save progress";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
