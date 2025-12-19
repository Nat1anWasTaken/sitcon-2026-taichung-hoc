import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { JailbreakMatch } from "@/lib/jailbreak-types";

export async function GET() {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore.collection("jailbreakMatches").get();
    const matches = snap.docs.map((doc) => {
        const data = doc.data() as JailbreakMatch;
        return { ...data, id: doc.id };
    });

    return NextResponse.json({ matches });
}

export const runtime = "nodejs";
