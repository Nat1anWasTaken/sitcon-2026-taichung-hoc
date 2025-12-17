import { NextRequest, NextResponse } from "next/server";

import { getSectionProgress, saveSectionProgress } from "@/lib/server/progress";
import { requireChildSession } from "@/lib/server/session";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sectionId: string }> }
) {
    try {
        const { sectionId } = await params;
        const session = requireChildSession(req);
        const progress = await getSectionProgress(session.childId, sectionId);
        return NextResponse.json({ progress });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        return NextResponse.json({ error: message }, { status: 401 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ sectionId: string }> }
) {
    try {
        const { sectionId } = await params;
        const session = requireChildSession(req);
        const body = await req.json();
        await saveSectionProgress(session.childId, sectionId, body);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        return NextResponse.json({ error: message }, { status: 401 });
    }
}
export const runtime = "nodejs";
