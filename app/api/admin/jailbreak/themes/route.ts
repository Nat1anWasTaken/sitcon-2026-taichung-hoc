import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { JailbreakTheme } from "@/lib/jailbreak-types";

export async function GET() {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore.collection("jailbreakThemes").get();
    const themes = snap.docs.map((doc) => {
        const data = doc.data() as JailbreakTheme;
        return { ...data, id: doc.id };
    });

    return NextResponse.json({ themes });
}

export const runtime = "nodejs";
