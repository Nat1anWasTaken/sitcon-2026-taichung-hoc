import { NextRequest, NextResponse } from "next/server";

import { buildJailbreakScoreboard } from "@/lib/server/jailbreak-scoreboard";
import { buildScoreboardSnapshot } from "@/lib/server/scoreboard";

export const runtime = "nodejs";

type CombinedScoreboard = {
    garden: Awaited<ReturnType<typeof buildScoreboardSnapshot>>;
    jailbreak: Awaited<ReturnType<typeof buildJailbreakScoreboard>>;
};

async function buildCombined(): Promise<CombinedScoreboard> {
    const [garden, jailbreak] = await Promise.all([
        buildScoreboardSnapshot(),
        buildJailbreakScoreboard(),
    ]);
    return { garden, jailbreak };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    // Simple JSON snapshot for debugging or fallback clients.
    if (mode === "json") {
        try {
            const payload = await buildCombined();
            return NextResponse.json(payload, {
                status: 200,
                headers: { "Cache-Control": "no-store" },
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to build scoreboard";
            return NextResponse.json({ error: message }, { status: 500 });
        }
    }

    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = async () => {
                try {
                    const payload = await buildCombined();
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "scoreboard-error";
                    controller.enqueue(
                        encoder.encode(
                            `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`
                        )
                    );
                }
            };

            await send();
            timer = setInterval(send, 3000);

            const abortHandler = () => {
                if (closed) return;
                closed = true;
                if (timer) clearInterval(timer);
                controller.close();
            };

            req.signal.addEventListener("abort", abortHandler);
        },
        cancel() {
            if (closed) return;
            closed = true;
            if (timer) clearInterval(timer);
        },
    });

    return new NextResponse(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
