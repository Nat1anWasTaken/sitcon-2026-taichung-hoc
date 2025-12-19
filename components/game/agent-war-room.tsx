"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Telescope, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AgentLevel, AgentStage } from "@/lib/agent-types";

type ProgressPayload = {
    progress: { currentLevelOrder: number; waitingCueType?: string | null };
    stages: AgentStage[];
    levels: AgentLevel[];
    cues: Array<{ id: string; type?: string; active: boolean }>;
};

type RunEvent =
    | { type: "tool_call"; name: string; params: Record<string, unknown> }
    | { type: "tool_result"; name: string; result: unknown };

type RunResponse = {
    events: RunEvent[];
    finalAnswer: string;
    finalAnswerJson?: unknown;
    passed: boolean;
    usage?: { totalTokens?: number };
    failureReason?: string;
    waitingCueType?: string | null;
};

function StagePill({ stageType }: { stageType: string }) {
    return (
        <Badge variant="outline" className="border-foreground bg-secondary-background">
            {stageType}
        </Badge>
    );
}

export function AgentWarRoom() {
    const [progress, setProgress] = useState<ProgressPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [events, setEvents] = useState<RunEvent[]>([]);
    const [final, setFinal] = useState<RunResponse | null>(null);
    const [running, setRunning] = useState(false);

    const streamTimer = useRef<NodeJS.Timeout | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/agent/progress", { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to load");
            setProgress(json as ProgressPayload);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, 4000);
        return () => clearInterval(id);
    }, [load]);

    const currentLevel = useMemo(() => {
        if (!progress) return null;
        return progress.levels.find((l) => l.order === progress.progress.currentLevelOrder) ?? null;
    }, [progress]);

    const waitingCue = useMemo(() => {
        if (!progress?.progress.waitingCueType) return null;
        const cueType = progress.progress.waitingCueType;
        const active = progress.cues.some((c) => c.id === cueType && c.active);
        return active ? null : cueType;
    }, [progress]);

    const startStream = (incoming: RunEvent[]) => {
        if (streamTimer.current) clearInterval(streamTimer.current);
        setEvents([]);
        let idx = 0;
        streamTimer.current = setInterval(() => {
            setEvents((prev) => prev.concat(incoming[idx]));
            idx += 1;
            if (idx >= incoming.length && streamTimer.current) {
                clearInterval(streamTimer.current);
                streamTimer.current = null;
            }
        }, 300);
    };

    const onRun = async () => {
        if (!currentLevel || running) return;
        setRunning(true);
        setFinal(null);
        setEvents([]);
        try {
            const res = await fetch("/api/agent/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });
            const json = (await res.json()) as RunResponse & { waitingCue?: string };
            if (!res.ok) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errJson = json as any;
                setError(errJson.message || errJson.error || "Run failed");
                return;
            }
            startStream(json.events ?? []);
            setFinal(json);
            setError(null);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Run failed");
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-4 border-foreground bg-background shadow-shadow">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            Agent War Room
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            ReAct 多步工具調度，邊跑邊看工具與結果。
                        </p>
                    </div>
                    {currentLevel && <StagePill stageType={currentLevel.stageType} />}
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading && (
                        <div className="flex items-center gap-2 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading…
                        </div>
                    )}
                    {error && <div className="text-sm text-destructive">{error}</div>}
                    {currentLevel && (
                        <div className="space-y-2">
                            <div className="text-lg font-semibold">{currentLevel.briefing}</div>
                            <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm">
                                <div className="font-semibold">任務</div>
                                <div>{currentLevel.taskPrompt}</div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="secondary" className="border-2 border-foreground">
                                    允許工具：{currentLevel.allowedTools.join(", ") || "無"}
                                </Badge>
                                <Badge variant="secondary" className="border-2 border-foreground">
                                    Max steps: {currentLevel.maxSteps ?? 5}
                                </Badge>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold">輸入提示</label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={running || Boolean(waitingCue)}
                            placeholder="輸入你要指揮 Agent 的提示，盡量精準且少 token。"
                            className="min-h-[120px]"
                        />
                        <div className="flex items-center gap-2">
                            <Button onClick={onRun} disabled={running || Boolean(waitingCue)}>
                                {running ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        執行中…
                                    </>
                                ) : (
                                    <>
                                        <Workflow className="mr-2 h-4 w-4" />
                                        Run level
                                    </>
                                )}
                            </Button>
                            <Input
                                value={prompt.length}
                                readOnly
                                className="w-24 text-center font-mono"
                                title="character count"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Telescope className="h-4 w-4" />
                            串流事件
                        </div>
                        <div className="space-y-2">
                            {events.map((ev, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm"
                                >
                                    <div className="font-semibold">
                                        {ev.type === "tool_call" ? "Tool call" : "Tool result"} ·{" "}
                                        {ev.name}
                                    </div>
                                    <pre className="mt-1 whitespace-pre-wrap text-xs">
                                        {JSON.stringify(
                                            ev.type === "tool_call" ? ev.params : ev.result,
                                            null,
                                            2
                                        )}
                                    </pre>
                                </div>
                            ))}
                            {!events.length && (
                                <div className="text-xs text-muted-foreground">等待輸出…</div>
                            )}
                        </div>
                    </div>

                    {final && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Sparkles className="h-4 w-4" />
                                最終回答
                            </div>
                            <div className="rounded-md border-4 border-foreground bg-background px-3 py-2 shadow-shadow">
                                <div className="font-semibold text-green-700">
                                    {final.passed
                                        ? "PASS"
                                        : `FAIL (${final.failureReason ?? "unknown"})`}
                                </div>
                                <div className="text-sm whitespace-pre-wrap">
                                    {final.finalAnswer}
                                </div>
                                {final.usage?.totalTokens != null && (
                                    <div className="text-xs text-muted-foreground">
                                        totalTokens ≈ {final.usage.totalTokens}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-4 border-foreground bg-secondary-background shadow-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5" />
                        關卡進度
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {progress?.levels?.map((lvl) => (
                        <div
                            key={lvl.id}
                            className={`rounded-md border-2 px-3 py-2 ${
                                progress.progress.currentLevelOrder === lvl.order
                                    ? "border-foreground bg-background"
                                    : "border-dashed border-foreground/60 bg-white"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">{lvl.id}</div>
                                <StagePill stageType={lvl.stageType} />
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                                {lvl.briefing}
                            </div>
                        </div>
                    ))}
                    <div className="text-xs text-muted-foreground">
                        排行榜依成功 run 的 totalTokens 由低到高。
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
