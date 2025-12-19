import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { ChildAccount } from "@/lib/types";

export async function GET() {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const snap = await adminFirestore.collection("children").orderBy("seatNumber", "asc").get();
    const children = snap.docs.map((doc) => {
        const data = doc.data() as ChildAccount;
        return { ...data, childId: data.childId ?? doc.id };
    });

    return NextResponse.json({ children });
}

export const runtime = "nodejs";
