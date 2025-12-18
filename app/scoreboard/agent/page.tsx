"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AgentScoreboardRow } from "@/lib/agent-types";

type ScoreboardPayload = { generatedAt: string; rows: AgentScoreboardRow[] };

export default function AgentScoreboardPage() {
    const [data, setData] = useState<ScoreboardPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const res = await fetch("/api/scoreboard/agent", { cache: "no-store" });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Failed to load scoreboard");
                if (active) {
                    setData(json);
                    setError(null);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load scoreboard");
            }
        };
        load();
        const id = setInterval(load, 5000);
        return () => {
            active = false;
            clearInterval(id);
        };
    }, []);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Agent Leaderboard</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Token 越少分數越高。只計成功通關的 run。
                    </div>
                </CardHeader>
                <CardContent>
                    {error && <div className="text-destructive mb-3 text-sm">{error}</div>}
                    <div className="rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Seat</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Stage</TableHead>
                                    <TableHead>Tokens</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Best?</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data?.rows?.length ? (
                                    data.rows.map((row, idx) => (
                                        <TableRow key={`${row.childId}-${row.levelId}-${idx}`}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell>{row.seatNumber}</TableCell>
                                            <TableCell>{row.name ?? "—"}</TableCell>
                                            <TableCell>{row.levelId}</TableCell>
                                            <TableCell>{row.stageType}</TableCell>
                                            <TableCell>{row.totalTokens ?? "?"}</TableCell>
                                            <TableCell>{row.score}</TableCell>
                                            <TableCell>{row.bestForLevel ? "✅" : ""}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-sm">
                                            {error ? "Failed to load." : "No runs yet."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
