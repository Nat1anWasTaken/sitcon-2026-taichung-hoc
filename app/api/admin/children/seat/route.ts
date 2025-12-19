import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { ChildModel, IChild } from "@/lib/models/child";

export async function GET(req: NextRequest) {
    const seatNumberParam = req.nextUrl.searchParams.get("seatNumber");
    const seatNumber = seatNumberParam ? Number(seatNumberParam) : NaN;
    if (!Number.isFinite(seatNumber)) {
        return NextResponse.json({ error: "seatNumber required" }, { status: 400 });
    }

    await connectToDatabase();
    const child = await ChildModel.findOne({ seatNumber }).lean<IChild | null>();
    if (!child) {
        return NextResponse.json({ child: null });
    }

    const { _id, ...rest } = child;
    return NextResponse.json({ child: { ...rest, childId: child.childId ?? _id } });
}

export const runtime = "nodejs";
