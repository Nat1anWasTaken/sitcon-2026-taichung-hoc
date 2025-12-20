import { NextRequest, NextResponse } from "next/server";

import { ChildAccount } from "@/lib/types";
import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel, IChild } from "@/lib/models/child";

export async function GET() {
    await connectToDatabase();
    const docs = await ChildModel.find({}).sort({ seatNumber: 1 }).lean<IChild[]>();
    const children = docs.map((doc) => {
        const { _id, ...rest } = doc as IChild & { _id?: string };
        const childId = rest.childId ?? _id ?? "";
        return { ...(rest as unknown as ChildAccount), childId };
    });

    return NextResponse.json({ children });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const childId = String(body.childId ?? "").trim();
        const seatNumber = Number(body.seatNumber);
        const passwordSalt = String(body.passwordSalt ?? "");
        const passwordHash = String(body.passwordHash ?? "");
        const name = body.name ?? null;
        const status = body.status ?? "active";
        const hasPassword = passwordSalt.length > 0 || passwordHash.length > 0;

        if (
            !childId ||
            !Number.isFinite(seatNumber) ||
            (hasPassword && (!passwordSalt || !passwordHash))
        ) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        await connectToDatabase();
        // createdAt and updatedAt are automatically managed by Mongoose via timestamps: true
        await ChildModel.create({
            _id: childId,
            childId,
            seatNumber,
            passwordSalt,
            passwordHash,
            name,
            status,
        });

        return NextResponse.json({ childId }, { status: 201 });
    } catch (error: unknown) {
        const code = (error as { code?: number }).code;
        if (code === 11000) {
            return NextResponse.json({ error: "Child already exists" }, { status: 409 });
        }
        const message = error instanceof Error ? error.message : "Failed to create child";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
