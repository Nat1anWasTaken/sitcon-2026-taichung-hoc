import { NextRequest, NextResponse } from "next/server";

import { hashPassword } from "@/lib/passwords";
import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel, IChild } from "@/lib/models/child";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ childId: string }> }
) {
    const { childId } = await params;
    const { password } = await req.json();
    if (!childId || !password) {
        return NextResponse.json({ error: "childId and password required" }, { status: 400 });
    }

    await connectToDatabase();
    const child = await ChildModel.findById(childId).lean<IChild | null>();
    if (!child) {
        return NextResponse.json({ ok: false }, { status: 404 });
    }

    const hash = await hashPassword(password, child.passwordSalt);
    return NextResponse.json({ ok: hash === child.passwordHash });
}

export const runtime = "nodejs";
