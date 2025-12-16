import { NextRequest, NextResponse } from "next/server";

import { parseChildSessionToken } from "@/lib/server/session";

const COOKIE_NAME = "child_session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = parseChildSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.json({ session });
}
export const runtime = "nodejs";
