import { NextResponse } from "next/server";

import { fetchSectionOneConfig } from "@/lib/server/section-one";

export async function GET() {
    try {
        const data = await fetchSectionOneConfig();
        return NextResponse.json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load config";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const runtime = "nodejs";
