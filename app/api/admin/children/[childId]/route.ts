import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel } from "@/lib/models/child";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ childId: string }> }
) {
    try {
        const { childId } = await params;
        if (!childId) {
            return NextResponse.json({ error: "childId required" }, { status: 400 });
        }

        const body = await req.json();
        const updates: Record<string, unknown> = {};
        if (typeof body.name !== "undefined") updates.name = body.name;
        if (typeof body.status !== "undefined") updates.status = body.status;
        if (typeof body.passwordSalt !== "undefined") updates.passwordSalt = body.passwordSalt;
        if (typeof body.passwordHash !== "undefined") updates.passwordHash = body.passwordHash;
        if (typeof body.seatNumber !== "undefined")
            updates.seatNumber = Number(body.seatNumber);
        updates.updatedAt = new Date();

        if (Object.keys(updates).length === 1) {
            return NextResponse.json({ error: "No updates provided" }, { status: 400 });
        }

        await connectToDatabase();
        const result = await ChildModel.updateOne({ _id: childId }, { $set: updates });
        if (!result.matchedCount) {
            return NextResponse.json({ error: "Child not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const code = (error as { code?: number }).code;
        if (code === 11000) {
            return NextResponse.json({ error: "Seat already in use" }, { status: 409 });
        }
        const message = error instanceof Error ? error.message : "Failed to update child";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ childId: string }> }
) {
    try {
        const { childId } = await params;
        if (!childId) {
            return NextResponse.json({ error: "childId required" }, { status: 400 });
        }

        await connectToDatabase();
        const result = await ChildModel.deleteOne({ _id: childId });
        if (!result.deletedCount) {
            return NextResponse.json({ error: "Child not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to delete child";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
