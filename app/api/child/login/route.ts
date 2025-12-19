import { NextRequest, NextResponse } from "next/server";

import { hashPassword } from "@/lib/passwords";
import { setChildSessionCookie, clearChildSessionCookie } from "@/lib/server/session";
import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel, IChild } from "@/lib/models/child";

export async function POST(req: NextRequest) {
    const { childId, password } = await req.json();
    if (!childId || !password) {
        return NextResponse.json({ error: "childId and password required" }, { status: 400 });
    }

    await connectToDatabase();
    const child = await ChildModel.findById(childId).lean<IChild | null>();
    if (!child) {
        return NextResponse.json({ error: "Child not found" }, { status: 401 });
    }

    if (child.status === "disabled") {
        return NextResponse.json({ error: "This seat is disabled" }, { status: 403 });
    }

    const computed = await hashPassword(password, child.passwordSalt);
    if (computed !== child.passwordHash) {
        return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    const session = {
        childId: child.childId ?? child._id,
        seatNumber: child.seatNumber,
        name: child.name ?? null,
        issuedAt: Date.now(),
    };

    const res = NextResponse.json({ session });
    setChildSessionCookie(res, session);

    await ChildModel.updateOne(
        { _id: childId },
        { $set: { lastLoginAt: new Date() } }
    );

    return res;
}

export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    clearChildSessionCookie(res);
    return res;
}
export const runtime = "nodejs";
