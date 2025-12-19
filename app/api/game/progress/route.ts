import { NextRequest, NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { SectionProgress } from "@/lib/game-types";

export async function GET(req: NextRequest) {
    const childId = req.nextUrl.searchParams.get("childId") ?? "";
    if (!childId) {
        return NextResponse.json({ error: "childId required" }, { status: 400 });
    }
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore
        .collection("childProgress")
        .doc(childId)
        .collection("sections")
        .get();
    const progress: Record<string, SectionProgress> = {};
    snap.forEach((doc) => {
        const data = doc.data() as SectionProgress;
        progress[doc.id] = { ...data, sectionId: data.sectionId ?? doc.id };
    });

    return NextResponse.json({ progress });
}

export const runtime = "nodejs";
