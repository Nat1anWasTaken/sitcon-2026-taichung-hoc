import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "child_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export type ChildSession = {
    childId: string;
    seatNumber: number;
    name?: string | null;
    issuedAt: number;
};

function getSecret() {
    const secret = process.env.CHILD_SESSION_SECRET;
    if (!secret) {
        throw new Error("Missing CHILD_SESSION_SECRET env for session signing.");
    }
    return secret;
}

function sign(payload: string) {
    const secret = getSecret();
    return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createChildSessionToken(session: ChildSession) {
    const base = Buffer.from(JSON.stringify(session)).toString("base64url");
    const signature = sign(base);
    return `${base}.${signature}`;
}

export function parseChildSessionToken(token: string | undefined | null): ChildSession | null {
    if (!token) return null;
    const [base, signature] = token.split(".");
    if (!base || !signature) return null;
    if (sign(base) !== signature) return null;
    try {
        const payload = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as ChildSession;
        if (Date.now() - payload.issuedAt > SESSION_TTL_MS) return null;
        return payload;
    } catch (err) {
        console.error("Failed to parse session token", err);
        return null;
    }
}

const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
};

export function setChildSessionCookie(res: NextResponse, session: ChildSession) {
    const token = createChildSessionToken(session);
    res.cookies.set({
        name: COOKIE_NAME,
        value: token,
        ...cookieOptions,
    });
    return token;
}

export function clearChildSessionCookie(res: NextResponse) {
    res.cookies.set({
        name: COOKIE_NAME,
        value: "",
        ...cookieOptions,
        maxAge: 0,
    });
}

export function requireChildSession(req?: NextRequest): ChildSession {
    const token = req ? req.cookies.get(COOKIE_NAME)?.value : cookies().get(COOKIE_NAME)?.value;
    const session = parseChildSessionToken(token);
    if (!session) {
        throw new Error("No valid child session");
    }
    return session;
}
