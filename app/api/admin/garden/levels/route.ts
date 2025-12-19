import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { GardenLevel } from "@/lib/garden-types";

export async function GET() {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore
        .collection("gardenLevels")
        .orderBy("levelNumber", "asc")
        .get();
    const levels = snap.docs.map((doc) => {
        const data = doc.data() as GardenLevel;
        return { ...data, id: doc.id };
    });

    return NextResponse.json({ levels });
}

export const runtime = "nodejs";
