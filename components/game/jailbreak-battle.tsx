"use client";

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
import { useEffect, useMemo, useRef, useState } from "react";

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

const TURN_LIMIT_SECONDS = 60;

export function JailbreakBattle() {
    const router = useRouter();
    const [session, setSession] = useState<ChildSession | null>(null);
    const [matchState, setMatchState] = useState<FetchState<PublicMatchView>>({
        loading: true,
        data: null,
    });
    const [attackInput, setAttackInput] = useState("");
    const [developerDraft, setDeveloperDraft] = useState("");
    const [developerDirty, setDeveloperDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [streamingResponse, setStreamingResponse] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const developerDraftRef = useRef("");
    const developerDirtyRef = useRef(false);
    const lastServerDeveloperPromptRef = useRef("");
    const lastThemeKeyRef = useRef("");

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
                      "第 2 單元已鎖定或第 1 部分尚未完成。請完成第 1 部分並等待管理員提示。"
                    : data.error || "尚無對戰",
            });
            return;
        }
        const data = await res.json();
        setMatchState({ loading: false, data: data.match });
        const serverPrompt = data.match?.developerPrompt ?? "";
        const themeKey = `${data.match?.themeTitle ?? ""}||${data.match?.themeDescription ?? ""}`;
        const themeChanged = themeKey !== lastThemeKeyRef.current;
        if (themeChanged) {
            setDeveloperDraft(serverPrompt);
            setDeveloperDirty(false);
            lastServerDeveloperPromptRef.current = serverPrompt;
            lastThemeKeyRef.current = themeKey;
            return;
        }
        if (serverPrompt !== lastServerDeveloperPromptRef.current) {
            const localDraft = developerDraftRef.current;
            const localDirty = developerDirtyRef.current;
            const shouldSync =
                !localDirty ||
                !localDraft.trim() ||
                localDraft === lastServerDeveloperPromptRef.current;
            if (shouldSync) {
                setDeveloperDraft(serverPrompt);
                setDeveloperDirty(false);
            }
            lastServerDeveloperPromptRef.current = serverPrompt;
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
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        developerDraftRef.current = developerDraft;
    }, [developerDraft]);

    useEffect(() => {
        developerDirtyRef.current = developerDirty;
    }, [developerDirty]);

    useEffect(() => {
        if (!session) return;
        fetchMatch(true);
        const id = setInterval(() => fetchMatch(false), 2000);
        return () => clearInterval(id);
    }, [session]);

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
                throw new Error(data.error || "攻擊失敗");
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("沒有回應內容");

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
            const message = err instanceof Error ? err.message : "攻擊失敗";
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
            if (!res.ok) throw new Error(data.error || "修補失敗");
            setMatchState({ loading: false, data: data.match });
            const serverPrompt = data.match?.developerPrompt ?? developerDraft.trim();
            setDeveloperDraft(serverPrompt);
            setDeveloperDirty(false);
            lastServerDeveloperPromptRef.current = serverPrompt;
            if (data.match) {
                lastThemeKeyRef.current = `${data.match.themeTitle ?? ""}||${
                    data.match.themeDescription ?? ""
                }`;
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "修補失敗";
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
                座位 {session.seatNumber} · {session.childId}
                {session.name ? ` · ${session.name}` : ""}
            </div>
        );
    }, [session]);

    const viewportHeightClass = "min-h-full";

    if (!session) {
        return (
            <div
                className={`flex ${viewportHeightClass} items-center justify-center bg-background`}
            >
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                    連線中…
                </div>
            </div>
        );
    }

    if (matchState.loading) {
        return (
            <div
                className={`flex ${viewportHeightClass} items-center justify-center bg-background`}
            >
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                    載入你的對戰…
                </div>
            </div>
        );
    }

    if (!matchState.data) {
        return (
            <div
                className={`flex ${viewportHeightClass} items-center justify-center bg-background px-4`}
            >
                <Card className="w-full max-w-xl">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>尚未分配對戰</CardTitle>
                        <Badge variant="outline">第二單元</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                            座位 {session.seatNumber} · {session.childId}
                            {session.name ? ` · ${session.name}` : ""}
                        </div>
                        <p className="font-semibold">講師尚未分配文字攻防對戰。</p>
                        <p className="text-sm text-foreground/70">
                            請保持此分頁開啟 — 一旦建立對戰遊戲會自動重新整理。
                        </p>
                        <Button variant="ghost" onClick={() => fetchMatch()} className="gap-2">
                            <Timer className="h-4 w-4" />
                            再次檢查
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
    const deadlineMs = match?.phaseExpiresAt ? new Date(match.phaseExpiresAt).getTime() : null;
    const secondsLeft =
        deadlineMs !== null ? Math.max(0, Math.floor((deadlineMs - now) / 1000)) : null;
    const turnExpired = deadlineMs !== null && deadlineMs <= now;

    const role = matchState.data?.role ?? "attacker";
    const isAttacker = role === "attacker";
    const canPatchPhase = matchState.data?.currentPhase === "DEFENDER_PATCH" && role === "defender";
    const canAttack = matchState.data?.currentPhase === "ATTACK_PHASE" && !turnExpired;
    const canPatch = canPatchPhase && !turnExpired;

    return (
        <div className="min-h-full bg-background px-4 py-8">
            <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="-ml-2 border-2 border-border"
                        >
                            <a href="/game" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                返回
                            </a>
                        </Button>
                        {headerChip}
                        <Badge variant="secondary" className="text-sm font-bold uppercase">
                            第二單元 · 文字攻防對戰
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        {isAttacker ? (
                            <Swords className="h-4 w-4" />
                        ) : (
                            <ShieldCheck className="h-4 w-4" />
                        )}
                        {isAttacker ? "攻方" : "守方"} · 裂縫 {match.cracksCompleted}/3
                        {match.totalThemes && match.totalThemes > 1 && (
                            <span className="text-foreground/70">
                                · 主題 {(match.themesCompleted ?? 0) + 1}/{match.totalThemes}
                            </span>
                        )}
                    </div>
                </header>

                <Card>
                    <CardHeader className="space-y-3">
                        <div>
                            <CardTitle>{match.themeTitle}</CardTitle>
                            <CardDescription>{match.themeDescription}</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-wrap items-start gap-2">
                                <StatusPill phase={match.currentPhase} />
                                <Badge variant="outline">
                                    得分 · 攻方: {match.attackerScore} · 守方: {match.defenderScore}
                                </Badge>
                                {match.totalThemes && match.totalThemes > 1 && (
                                    <Badge
                                        variant="outline"
                                        className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                                    >
                                        關卡 {(match.themesCompleted ?? 0) + 1}/{match.totalThemes}
                                    </Badge>
                                )}
                            </div>
                            <TurnTimerPill
                                secondsLeft={secondsLeft}
                                turnExpired={turnExpired}
                                phase={match.currentPhase}
                            />
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
                                secondsLeft={secondsLeft}
                                turnExpired={turnExpired}
                            />
                        ) : (
                            <DefenderPanel
                                developerPrompt={developerDraft}
                                setDeveloperPrompt={(value) => {
                                    setDeveloperDraft(value);
                                    setDeveloperDirty(
                                        value !== lastServerDeveloperPromptRef.current
                                    );
                                }}
                                onSave={handlePatch}
                                canPatch={canPatch && match.status !== "completed"}
                                busy={busy}
                                phase={match.currentPhase}
                                breachCriteria={match.breachCriteria}
                                secondsLeft={secondsLeft}
                                turnExpired={turnExpired}
                            />
                        )}
                        <div className="space-y-3">
                            <Label className="text-xs uppercase tracking-tight text-foreground/70">
                                即時日誌
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
                關卡完成
            </Badge>
        );
    }
    if (phase === "DEFENDER_PATCH") {
        return (
            <Badge variant="outline" className="bg-amber-200 text-amber-900">
                <Shield className="mr-1 h-3 w-3" />
                守方修補中
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-main text-main-foreground">
            <Swords className="mr-1 h-3 w-3" />
            攻擊階段
        </Badge>
    );
}

function TurnTimerPill({
    secondsLeft,
    turnExpired,
    phase,
}: {
    secondsLeft: number | null;
    turnExpired: boolean;
    phase: PublicMatchView["currentPhase"];
}) {
    if (phase === "COMPLETED") return null;

    const label = secondsLeft !== null ? formatSeconds(secondsLeft) : "計時器同步中…";
    const palette = turnExpired
        ? "border-destructive text-destructive"
        : "border-main text-foreground";

    return (
        <div
            className={`inline-flex items-center gap-3 rounded-md border-4 bg-secondary-background px-3 py-2 text-sm font-bold shadow-shadow ${palette}`}
        >
            <div
                className={`flex h-8 w-8 items-center justify-center rounded-sm border-2 border-foreground bg-background ${
                    turnExpired ? "text-destructive" : "text-main"
                }`}
                aria-hidden
            >
                <Timer className="h-4 w-4" />
            </div>
            <div className="leading-tight">
                <div className="uppercase text-[10px] tracking-wide text-foreground/70">
                    回合計時
                </div>
                <div>{turnExpired ? "時間到" : label}</div>
            </div>
            <div className="rounded-sm bg-main px-2 text-[10px] font-black uppercase tracking-wide text-main-foreground">
                1:00
            </div>
        </div>
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
    secondsLeft,
    turnExpired,
}: {
    canAttack: boolean;
    attackInput: string;
    setAttackInput: (v: string) => void;
    onAttack: () => void;
    busy: boolean;
    phase: PublicMatchView["currentPhase"];
    cracks: number;
    secondsLeft: number | null;
    turnExpired: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                {phase === "DEFENDER_PATCH"
                    ? "守方正在修補防禦。請等待下一回合。"
                    : "發送巧妙提示以突破防禦。"}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-tight text-foreground/70">
                <Timer className="h-3 w-3" />
                {phase === "COMPLETED"
                    ? "關卡完成"
                    : turnExpired
                      ? "時間到 — 請稍候下一階段。"
                      : formatSeconds(secondsLeft ?? TURN_LIMIT_SECONDS)}
            </div>
            <div className="space-y-2">
                <Label>終端機</Label>
                <Textarea
                    placeholder="輸入你的文字攻防嘗試…"
                    value={attackInput}
                    onChange={(e) => setAttackInput(e.target.value)}
                    disabled={!canAttack || busy || phase === "COMPLETED"}
                />
            </div>
            <div className="flex items-center gap-3">
                <Button
                    onClick={onAttack}
                    disabled={!canAttack || busy || !attackInput.trim() || turnExpired}
                >
                    {busy ? "執行中…" : "發動攻擊"}
                </Button>
                <CrackMeter cracks={cracks} />
            </div>
            {!canAttack && phase !== "COMPLETED" && (
                <div className="text-xs font-semibold text-foreground/70">
                    請等待守方修補後再發送下一次攻擊。
                </div>
            )}
            {turnExpired && phase !== "COMPLETED" && (
                <div className="rounded-md border-4 border-destructive bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive shadow-shadow">
                    回合計時到 0:00。遊戲會自動切換到下一階段。
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
    breachCriteria,
    secondsLeft,
    turnExpired,
}: {
    developerPrompt: string;
    setDeveloperPrompt: (v: string) => void;
    onSave: () => void;
    canPatch: boolean;
    busy: boolean;
    phase: PublicMatchView["currentPhase"];
    breachCriteria?: string;
    secondsLeft: number | null;
    turnExpired: boolean;
}) {
    const helper =
        phase === "DEFENDER_PATCH"
            ? "重寫你的開發提示以阻止下一次攻擊。"
            : "當攻方試探防禦時鎖定。";
    return (
        <div className="space-y-3">
            <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                {helper}
            </div>
            {breachCriteria && (
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-tight text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        違規準則（AI 不可說的內容）
                    </Label>
                    <div className="rounded-md border-4 border-destructive bg-destructive/10 px-3 py-2 text-sm font-semibold shadow-shadow">
                        {breachCriteria}
                    </div>
                </div>
            )}
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-tight text-foreground/70">
                <Timer className="h-3 w-3" />
                {phase === "COMPLETED"
                    ? "關卡完成"
                    : turnExpired
                      ? "時間到 — 回合切換後攻方恢復行動。"
                      : `${formatSeconds(secondsLeft ?? TURN_LIMIT_SECONDS)} 待修補`}
            </div>
            <div className="space-y-2">
                <Label>開發者提示</Label>
                <Textarea
                    value={developerPrompt}
                    onChange={(e) => setDeveloperPrompt(e.target.value)}
                    disabled={!canPatch || busy || phase === "COMPLETED" || turnExpired}
                    placeholder="說明 AI 應如何行為以保護秘密。"
                />
            </div>
            <Button
                onClick={onSave}
                disabled={!canPatch || busy || !developerPrompt.trim() || turnExpired}
            >
                {busy ? "儲存中…" : "儲存並恢復攻擊"}
            </Button>
            {!canPatch && phase !== "COMPLETED" && (
                <div className="text-xs font-semibold text-foreground/70">
                    只有在攻方破解一層後才可修補。
                </div>
            )}
            {turnExpired && phase !== "COMPLETED" && (
                <div className="rounded-md border-4 border-destructive bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive shadow-shadow">
                    你已超時。回合將自動交回攻方。
                </div>
            )}
        </div>
    );
}

function CrackMeter({ cracks }: { cracks: number }) {
    return (
        <div className="flex items-center gap-2 text-xs font-semibold">
            <span>安全層</span>
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
                尚未有嘗試。
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {streamingResponse && (
                <div className="rounded-md border-4 border-main bg-secondary-background p-3 shadow-shadow animate-pulse">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-foreground/60">
                        <span>串流中...</span>
                        <span className="text-main">實況</span>
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                                <Shield className="h-3 w-3" />
                                AI 回應
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
                                log.breach
                                    ? "text-destructive"
                                    : "text-green-700 dark:text-green-500"
                            }
                        >
                            {log.breach ? "已違規" : "安全"}
                        </span>
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                                <Swords className="h-3 w-3" />
                                攻方
                            </div>
                            <div className="rounded-md border-2 border-border bg-background px-3 py-2 font-mono text-xs">
                                {log.attackerPrompt}
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                                <Shield className="h-3 w-3" />
                                AI 回應
                            </div>
                            <div className="rounded-md border-2 border-border bg-background px-3 py-2 text-sm">
                                {log.aiResponse}
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold">
                            {log.refereeReason && (
                                <span className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    裁判： {log.refereeReason}
                                </span>
                            )}
                            {typeof log.tokensUsed === "number" && (
                                <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    Tokens： {log.tokensUsed}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function formatSeconds(totalSeconds: number) {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
