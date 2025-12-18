import { NextRequest } from "next/server";

import { streamAttackAttempt } from "@/lib/server/jailbreak";
import { requireChildSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
    let session;
    try {
        session = await requireChildSession(req);
    } catch {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { prompt, matchId } = await req.json();
        if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Prompt is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of streamAttackAttempt({
                        childId: session.childId,
                        matchId,
                        attackerPrompt: prompt,
                    })) {
                        const data = `data: ${JSON.stringify(event)}\n\n`;
                        controller.enqueue(encoder.encode(data));
                    }
                    controller.close();
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Attack failed";
                    const errorEvent = {
                        type: "error",
                        error: message,
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Attack failed";
        const status = message.startsWith("Section 2") || message.startsWith("Complete Section 1")
            ? 403
            : 400;
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    }
}

export const runtime = "nodejs";
