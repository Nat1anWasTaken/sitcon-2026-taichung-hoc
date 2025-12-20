import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel, IChild } from "@/lib/models/child";

export async function GET() {
    await connectToDatabase();
    const docs = await ChildModel.find({}).sort({ seatNumber: 1 }).lean<IChild[]>();
    const children = docs.map((doc) => {
        const { _id, ...rest } = doc as IChild & { _id?: string };
        const childId = rest.childId ?? _id ?? "";
        return {
            seatNumber: rest.seatNumber,
            childId,
            name: rest.name ?? null,
            status: rest.status ?? "active",
            hasPassword: Boolean(rest.passwordSalt && rest.passwordHash),
        };
    });

    return NextResponse.json({ children });
}

export const runtime = "nodejs";
