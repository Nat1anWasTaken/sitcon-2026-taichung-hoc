import { NextResponse } from "next/server";

import { listActiveCues } from "@/lib/server/cues";

export async function GET() {
  const cues = await listActiveCues();
  return NextResponse.json({ cues });
}
export const runtime = "nodejs";
