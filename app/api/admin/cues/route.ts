import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { GameCue } from "@/lib/game-types";

export async function GET() {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore.collection("gameCues").orderBy("updatedAt", "desc").get();
    const cues = snap.docs.map((doc) => {
        const data = doc.data() as GameCue;
        return { ...data, id: doc.id };
    });

    return NextResponse.json({ cues });
}

export const runtime = "nodejs";
