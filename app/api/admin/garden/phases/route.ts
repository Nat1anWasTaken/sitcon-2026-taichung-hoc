import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { GardenPhase } from "@/lib/garden-types";

export async function GET() {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore.collection("gardenPhases").orderBy("order", "asc").get();
    const phases = snap.docs.map((doc) => {
        const data = doc.data() as GardenPhase;
        return { ...data, id: doc.id };
    });

    return NextResponse.json({ phases });
}

export const runtime = "nodejs";
