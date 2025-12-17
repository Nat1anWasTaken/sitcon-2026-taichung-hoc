import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/passwords";
import { setChildSessionCookie, clearChildSessionCookie } from "@/lib/server/session";
import { ChildAccount } from "@/lib/types";

export async function POST(req: NextRequest) {
    if (!adminFirestore) {
        return NextResponse.json({ error: "Server missing admin credentials" }, { status: 500 });
    }

    const { childId, password } = await req.json();
    if (!childId || !password) {
        return NextResponse.json({ error: "childId and password required" }, { status: 400 });
    }

    const snap = await adminFirestore.collection("children").doc(childId).get();
    if (!snap.exists) {
        return NextResponse.json({ error: "Child not found" }, { status: 401 });
    }

    const data = snap.data() as ChildAccount;
    if (data.status === "disabled") {
        return NextResponse.json({ error: "This seat is disabled" }, { status: 403 });
    }

    const computed = await hashPassword(password, data.passwordSalt);
    if (computed !== data.passwordHash) {
        return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    const session = {
        childId: data.childId,
        seatNumber: data.seatNumber,
        name: data.name ?? null,
        issuedAt: Date.now(),
    };

    const res = NextResponse.json({ session });
    setChildSessionCookie(res, session);

    await snap.ref.update({
        lastLoginAt: FieldValue.serverTimestamp(),
    });

    return res;
}

export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    clearChildSessionCookie(res);
    return res;
}
export const runtime = "nodejs";
