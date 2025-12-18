"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    BadgeCheck,
    Shield,
    ShieldCheck,
    Swords,
    Timer,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicMatchView } from "@/lib/jailbreak-types";

type ChildSession = {
    childId: string;
    seatNumber: number;
    name?: string | null;
};

type FetchState<T> = {
    loading: boolean;
    data: T | null;
    error?: string;
};

export function JailbreakBattle() {
    const router = useRouter();
    const [session, setSession] = useState<ChildSession | null>(null);
    const [matchState, setMatchState] = useState<FetchState<PublicMatchView>>({
        loading: true,
        data: null,
    });
    const [attackInput, setAttackInput] = useState("");
    const [developerDraft, setDeveloperDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [streamingResponse, setStreamingResponse] = useState("");

    const fetchMatch = async (showSpinner = false) => {
        // Only flip the full-screen loading state on the first load or when explicitly asked.
        setMatchState((s) => {
            if (showSpinner || (!s.data && !s.error)) {
                return { ...s, loading: true };
            }
            return s;
        });
        const res = await fetch("/api/jailbreak/match", { credentials: "include" });
        if (!res.ok) {
            const data = await res.json();
            const locked = res.status === 403;
            setMatchState({
                loading: false,
                data: null,
                error: locked
                    ? data.error ||
                      "Section 2 is locked or Section 1 is incomplete. Finish Section 1 and wait for the admin cue."
                    : data.error || "No match yet",
            });
            return;
        }
        const data = await res.json();
        setMatchState({ loading: false, data: data.match });
        if (data.match?.developerPrompt) {
            setDeveloperDraft(data.match.developerPrompt);
        }
    };

    useEffect(() => {
        const load = async () => {
            const meRes = await fetch("/api/child/me", { credentials: "include" });
            if (!meRes.ok) {
                router.replace("/");
                return;
            }
            const { session: me } = await meRes.json();
            setSession(me);
        };
        load();
    }, [router]);

    useEffect(() => {
        if (!session) return;
        fetchMatch(true);
        const id = setInterval(() => fetchMatch(false), 2000);
        return () => clearInterval(id);
    }, [session]);

    const role = matchState.data?.role ?? "attacker";
    const isAttacker = role === "attacker";
    const canAttack = matchState.data?.currentPhase === "ATTACK_PHASE";
    const canPatch = matchState.data?.currentPhase === "DEFENDER_PATCH" && role === "defender";

    const handleAttack = async () => {
        if (!attackInput.trim() || !matchState.data) return;
        setBusy(true);
        setStreamingResponse("");
        try {
            const res = await fetch("/api/jailbreak/attack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: attackInput.trim(),
                    matchId: matchState.data.matchId,
                }),
                credentials: "include",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Attack failed");
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        try {
                            const event = JSON.parse(data);
                            if (event.type === "chunk") {
                                setStreamingResponse((prev) => prev + event.content);
                            } else if (event.type === "complete") {
                                setMatchState({ loading: false, data: event.match });
                                setStreamingResponse("");
                                setAttackInput("");
                            } else if (event.type === "error") {
                                throw new Error(event.error);
                            }
                        } catch (e) {
                            if (e instanceof Error) throw e;
                        }
                    }
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Attack failed";
            setMatchState((s) => ({ ...s, error: message }));
            setStreamingResponse("");
        } finally {
            setBusy(false);
        }
    };

    const handlePatch = async () => {
        if (!developerDraft.trim() || !matchState.data) return;
        setBusy(true);
        try {
            const res = await fetch("/api/jailbreak/patch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    developerPrompt: developerDraft.trim(),
                    matchId: matchState.data.matchId,
                }),
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Patch failed");
            setMatchState({ loading: false, data: data.match });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Patch failed";
            setMatchState((s) => ({ ...s, error: message }));
        } finally {
            setBusy(false);
        }
    };

    const headerChip = useMemo(() => {
        if (!session) return null;
        return (
            <div className="inline-flex items-center gap-2 rounded-md border-4 border-foreground bg-secondary-background px-4 py-2 text-sm font-semibold shadow-shadow">
                <Shield className="h-4 w-4" />
                Seat {session.seatNumber} · {session.childId}
                {session.name ? ` · ${session.name}` : ""}
            </div>
        );
    }, [session]);

    const viewportHeightClass = "min-h-full";

    if (!session) {
        return (
            <div className={`flex ${viewportHeightClass} items-center justify-center bg-background`}>
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                    Connecting…
                </div>
            </div>
        );
    }

    if (matchState.loading) {
        return (
            <div className={`flex ${viewportHeightClass} items-center justify-center bg-background`}>
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                    Loading your battle…
                </div>
            </div>
        );
    }

    if (!matchState.data) {
        return (
            <div className={`flex ${viewportHeightClass} items-center justify-center bg-background px-4`}>
                <Card className="w-full max-w-xl">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>No match assigned</CardTitle>
                        <Badge variant="outline">Section 2</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="font-semibold">
                            Your coach has not assigned a Jailbreak battle yet.
                        </p>
                        <p className="text-sm text-foreground/70">
                            Keep this tab open — the game will refresh once a match is created.
                        </p>
                        <Button variant="ghost" onClick={() => fetchMatch()} className="gap-2">
                            <Timer className="h-4 w-4" />
                            Check again
                        </Button>
                        {matchState.error && (
                            <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                                {matchState.error}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const match = matchState.data;

    return (
        <div className="min-h-full bg-background px-4 py-8">
            <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="-ml-2 border-2 border-border"
                        >
                            <a href="/game" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </a>
                        </Button>
                        {headerChip}
                        <Badge variant="secondary" className="text-sm font-bold uppercase">
                            Section 2 · Jailbreak Battle
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        {isAttacker ? <Swords className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        {isAttacker ? "Attacker" : "Defender"} · Cracks {match.cracksCompleted}/3
                    </div>
                </header>

                <Card>
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>{match.themeTitle}</CardTitle>
                            <CardDescription>{match.themeDescription}</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusPill phase={match.currentPhase} />
                            <Badge variant="outline">
                                Scores · A: {match.attackerScore} · D: {match.defenderScore}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-6 lg:grid-cols-2">
                        {isAttacker ? (
                            <AttackerPanel
                                canAttack={canAttack && match.status !== "completed"}
                                attackInput={attackInput}
                                setAttackInput={setAttackInput}
                                onAttack={handleAttack}
                                busy={busy}
                                phase={match.currentPhase}
                                cracks={match.cracksCompleted}
                            />
                        ) : (
                            <DefenderPanel
                                developerPrompt={developerDraft}
                                setDeveloperPrompt={setDeveloperDraft}
                                onSave={handlePatch}
                                canPatch={canPatch && match.status !== "completed"}
                                busy={busy}
                                phase={match.currentPhase}
                            />
                        )}
                        <div className="space-y-3">
                            <Label className="text-xs uppercase tracking-tight text-foreground/70">
                                Live log
                            </Label>
                            <LogList logs={match.logs} streamingResponse={streamingResponse} />
                        </div>
                    </CardContent>
                </Card>
                {matchState.error && (
                    <div className="rounded-md border-4 border-destructive bg-secondary-background px-3 py-2 text-sm font-semibold text-destructive shadow-shadow">
                        {matchState.error}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusPill({ phase }: { phase: PublicMatchView["currentPhase"] }) {
    if (phase === "COMPLETED") {
        return (
            <Badge variant="outline" className="bg-green-200 text-green-800">
                <BadgeCheck className="mr-1 h-3 w-3" />
                Level complete
            </Badge>
        );
    }
    if (phase === "DEFENDER_PATCH") {
        return (
            <Badge variant="outline" className="bg-amber-200 text-amber-900">
                <Shield className="mr-1 h-3 w-3" />
                Defender patching
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-main text-main-foreground">
            <Swords className="mr-1 h-3 w-3" />
            Attack phase
        </Badge>
    );
}

function AttackerPanel({
    canAttack,
    attackInput,
    setAttackInput,
    onAttack,
    busy,
    phase,
    cracks,
}: {
    canAttack: boolean;
    attackInput: string;
    setAttackInput: (v: string) => void;
    onAttack: () => void;
    busy: boolean;
    phase: PublicMatchView["currentPhase"];
    cracks: number;
}) {
    return (
        <div className="space-y-4">
            <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                {phase === "DEFENDER_PATCH"
                    ? "Defender is fixing their wall. Wait for the next turn."
                    : "Send a clever prompt to break through the wall."}
            </div>
            <div className="space-y-2">
                <Label>Terminal</Label>
                <Textarea
                    placeholder="Type your jailbreak attempt…"
                    value={attackInput}
                    onChange={(e) => setAttackInput(e.target.value)}
                    disabled={!canAttack || busy || phase === "COMPLETED"}
                />
            </div>
            <div className="flex items-center gap-3">
                <Button onClick={onAttack} disabled={!canAttack || busy || !attackInput.trim()}>
                    {busy ? "Working…" : "Launch attack"}
                </Button>
                <CrackMeter cracks={cracks} />
            </div>
            {!canAttack && phase !== "COMPLETED" && (
                <div className="text-xs font-semibold text-foreground/70">
                    Wait for the defender to patch before sending the next attack.
                </div>
            )}
        </div>
    );
}

function DefenderPanel({
    developerPrompt,
    setDeveloperPrompt,
    onSave,
    canPatch,
    busy,
    phase,
}: {
    developerPrompt: string;
    setDeveloperPrompt: (v: string) => void;
    onSave: () => void;
    canPatch: boolean;
    busy: boolean;
    phase: PublicMatchView["currentPhase"];
}) {
    const helper =
        phase === "DEFENDER_PATCH"
            ? "Rewrite your developer prompt to block the next attack."
            : "Locked while the attacker is probing your wall.";
    return (
        <div className="space-y-3">
            <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                {helper}
            </div>
            <div className="space-y-2">
                <Label>Developer Prompt</Label>
                <Textarea
                    value={developerPrompt}
                    onChange={(e) => setDeveloperPrompt(e.target.value)}
                    disabled={!canPatch || busy || phase === "COMPLETED"}
                    placeholder="Explain how the AI should behave to keep the secret safe."
                />
            </div>
            <Button onClick={onSave} disabled={!canPatch || busy || !developerPrompt.trim()}>
                {busy ? "Saving…" : "Save & resume attacks"}
            </Button>
            {!canPatch && phase !== "COMPLETED" && (
                <div className="text-xs font-semibold text-foreground/70">
                    You can patch only after the attacker cracks a layer.
                </div>
            )}
        </div>
    );
}

function CrackMeter({ cracks }: { cracks: number }) {
    return (
        <div className="flex items-center gap-2 text-xs font-semibold">
            <span>Security layers</span>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={`h-4 w-8 rounded-sm border-2 border-foreground shadow-shadow ${
                        cracks > i ? "bg-destructive" : "bg-secondary-background"
                    }`}
                />
            ))}
        </div>
    );
}

function LogList({
    logs,
    streamingResponse,
}: {
    logs: PublicMatchView["logs"];
    streamingResponse?: string;
}) {
    if (logs.length === 0 && !streamingResponse) {
        return (
            <div className="rounded-md border-4 border-dashed border-border px-3 py-6 text-center text-sm font-semibold text-foreground/70">
                No attempts yet.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {streamingResponse && (
                <div className="rounded-md border-4 border-main bg-secondary-background p-3 shadow-shadow animate-pulse">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-foreground/60">
                        <span>Streaming...</span>
                        <span className="text-main">LIVE</span>
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                                <Shield className="h-3 w-3" />
                                AI Response
                            </div>
                            <div className="rounded-md border-2 border-border bg-background px-3 py-2 text-sm">
                                {streamingResponse}
                                <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {logs.map((log) => (
                <div
                    key={log.id}
                    className="rounded-md border-4 border-foreground bg-secondary-background p-3 shadow-shadow"
                >
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-foreground/60">
                        <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        <span
                            className={
                                log.breach ? "text-destructive" : "text-green-700 dark:text-green-500"
                            }
                        >
                            {log.breach ? "BREACHED" : "SAFE"}
                        </span>
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                                <Swords className="h-3 w-3" />
                                Attacker
                            </div>
                            <div className="rounded-md border-2 border-border bg-background px-3 py-2 font-mono text-xs">
                                {log.attackerPrompt}
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                                <Shield className="h-3 w-3" />
                                AI Response
                            </div>
                            <div className="rounded-md border-2 border-border bg-background px-3 py-2 text-sm">
                                {log.aiResponse}
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold">
                            {log.refereeReason && (
                                <span className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Referee: {log.refereeReason}
                                </span>
                            )}
                            {typeof log.tokensUsed === "number" && (
                                <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    Tokens: {log.tokensUsed}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
