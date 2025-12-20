"use client";

import { Loader2, Rabbit } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildRosterEntry } from "@/lib/types";

export default function Home() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [rosterError, setRosterError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [rosterLoading, setRosterLoading] = useState(true);
    const [roster, setRoster] = useState<ChildRosterEntry[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

    const selectedChild = useMemo(
        () => roster.find((child) => child.childId === selectedChildId) ?? null,
        [roster, selectedChildId]
    );

    useEffect(() => {
        let active = true;

        const loadRoster = async (showLoading: boolean) => {
            if (!active) return;
            if (showLoading) {
                setRosterLoading(true);
            }
            setRosterError(null);
            try {
                const res = await fetch("/api/child/roster");
                if (!res.ok) {
                    const message = await res.text();
                    throw new Error(message || "Failed to load roster");
                }
                const data = (await res.json()) as { children: ChildRosterEntry[] };
                if (!active) return;
                setRoster(Array.isArray(data.children) ? data.children : []);
            } catch (err: unknown) {
                if (!active) return;
                const message = err instanceof Error ? err.message : "Failed to load roster";
                setRosterError(message);
            } finally {
                if (!active) return;
                if (showLoading) {
                    setRosterLoading(false);
                }
            }
        };

        loadRoster(true);
        const interval = setInterval(() => {
            loadRoster(false);
        }, 2000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (!selectedChild) {
            setError("請先選擇座位");
            return;
        }
        if (selectedChild.status === "disabled") {
            setError("此座位已停用");
            return;
        }
        if (selectedChild.hasPassword && password.trim().length === 0) {
            setError("請輸入密碼");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/child/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ childId: selectedChild.childId, password }),
                credentials: "include",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Login failed");
            }
            const data = await res.json();
            if (data?.generatedPassword) {
                setGeneratedPassword(String(data.generatedPassword));
                return;
            }
            router.replace("/game");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Login failed";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (generatedPassword && selectedChild) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Rabbit className="h-5 w-5" />
                            密碼已建立
                        </CardTitle>
                        <CardDescription>
                            Seat {selectedChild.seatNumber} · {selectedChild.childId}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 text-center font-mono text-2xl font-semibold shadow-shadow">
                            {generatedPassword}
                        </div>
                        <p className="text-sm text-foreground/70">
                            請記住這組密碼，下次登入需要使用它。
                        </p>
                        <Button
                            type="button"
                            className="w-full"
                            onClick={() => router.replace("/game")}
                        >
                            進入遊戲
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Rabbit className="h-5 w-5" />
                        學生登入
                    </CardTitle>
                    <CardDescription>選擇座位後輸入密碼進入遊戲。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label>座位列表</Label>
                            {rosterLoading ? (
                                <div className="flex items-center gap-2 text-sm text-foreground/70">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    載入座位中…
                                </div>
                            ) : rosterError ? (
                                <div className="rounded-md border-4 border-destructive bg-secondary-background px-3 py-2 text-sm font-semibold text-destructive shadow-shadow">
                                    {rosterError}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {roster.map((child) => {
                                        const disabled = child.status === "disabled";
                                        const selected = child.childId === selectedChildId;
                                        return (
                                            <button
                                                key={child.childId}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => {
                                                    setSelectedChildId(child.childId);
                                                    setPassword("");
                                                    setError(null);
                                                }}
                                                className={`rounded-md border-4 px-3 py-2 text-left shadow-shadow transition ${
                                                    disabled
                                                        ? "cursor-not-allowed border-foreground/40 bg-secondary-background/60 text-foreground/50"
                                                        : selected
                                                          ? "border-foreground bg-main text-main-foreground"
                                                          : "border-foreground bg-secondary-background hover:-translate-y-0.5"
                                                }`}
                                            >
                                                <div className="text-xs uppercase tracking-wide opacity-80">
                                                    Seat {child.seatNumber}
                                                </div>
                                                <div className="font-mono text-sm font-semibold">
                                                    {child.childId}
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {child.name ? (
                                                        <Badge variant="outline">{child.name}</Badge>
                                                    ) : null}
                                                    {!child.hasPassword ? (
                                                        <Badge variant="default">首次登入</Badge>
                                                    ) : null}
                                                    {disabled ? (
                                                        <Badge variant="destructive">停用</Badge>
                                                    ) : null}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">密碼</Label>
                            <Input
                                id="password"
                                type="password"
                                required={Boolean(selectedChild?.hasPassword)}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={!selectedChild?.hasPassword}
                                placeholder={selectedChild?.hasPassword ? "••••••" : "首次登入不需輸入"}
                            />
                            {!selectedChild?.hasPassword && selectedChild ? (
                                <p className="text-xs text-foreground/70">
                                    首次登入將自動產生密碼，請記住它。
                                </p>
                            ) : null}
                        </div>
                        {error && (
                            <div className="rounded-md border-4 border-destructive bg-secondary-background px-3 py-2 text-sm font-semibold text-destructive shadow-shadow">
                                {error}
                            </div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading || !selectedChild}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    檢查中…
                                </>
                            ) : (
                                "開始遊玩"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
