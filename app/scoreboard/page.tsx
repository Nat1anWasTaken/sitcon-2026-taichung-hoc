"use client";

import { Activity, RadioTower, RefreshCw, Swords, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allSections } from "@/lib/game/config";
import { ScoreboardRow, ScoreboardSection } from "@/lib/scoreboard-types";
import { JailbreakScoreboardRow } from "@/lib/jailbreak-scoreboard-types";
import { useScoreboard, sectionPhaseLabel } from "@/hooks/use-scoreboard";

function formatUpdated(value?: string) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusLabel(row: ScoreboardRow) {
    if (row.sectionComplete) return "Completed";
    if (row.phase3Complete) return "Completed";
    if (row.phase2Complete && row.currentPhase === 3) return "Final phase";
    if (row.phase1Complete && row.currentPhase === 2) return "Phase 2";
    return `Phase ${row.currentPhase} · Level ${row.currentLevel}`;
}

function LivePill({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-secondary-background px-3 py-1 text-xs font-semibold shadow-shadow">
            <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-600" />
            </span>
            {label}
        </span>
    );
}

function PhaseTabs({
    section,
    active,
    onChange,
}: {
    section: ScoreboardSection;
    active: string;
    onChange: (phase: string) => void;
}) {
    return (
        <Tabs value={active} onValueChange={onChange} className="w-full">
            <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-secondary-background">
                <TabsTrigger value="all">All phases</TabsTrigger>
                {Array.from({ length: section.phases }).map((_, idx) => (
                    <TabsTrigger key={idx} value={`phase-${idx + 1}`}>
                        {sectionPhaseLabel(section, idx + 1)}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

function SectionTable({
    section,
    phaseFilter,
}: {
    section: ScoreboardSection;
    phaseFilter: string;
}) {
    const filtered = useMemo(() => {
        if (phaseFilter === "all") return section.rows;
        const phaseNumber = Number(phaseFilter.split("-")[1]);
        if (Number.isNaN(phaseNumber)) return section.rows;
        return section.rows.filter((row) => row.currentPhase === phaseNumber);
    }, [phaseFilter, section.rows]);

    return (
        <div className="overflow-hidden rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
            <div className="grid grid-cols-2 gap-2 border-b-4 border-foreground bg-main px-4 py-3 text-xs font-semibold uppercase text-foreground">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Players
                </div>
                <div className="flex items-center justify-end gap-2 text-right">
                    <Activity className="h-4 w-4" /> Progress
                </div>
            </div>
            <div className="divide-y-4 divide-foreground/60">
                {filtered.length === 0 && (
                    <div className="px-4 py-6 text-sm font-semibold text-foreground/70">
                        No players yet for this section.
                    </div>
                )}
                {filtered.map((row) => (
                    <div
                        key={`${section.sectionId}-${row.childId}`}
                        className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3 sm:items-center"
                    >
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">
                                Seat {row.seatNumber} · {row.childId}
                            </p>
                            {row.name && (
                                <p className="text-xs uppercase tracking-tight text-foreground/60">
                                    {row.name}
                                </p>
                            )}
                            {row.status === "disabled" && <Badge variant="outline">Disabled</Badge>}
                        </div>
                        <div className="space-y-1 text-sm font-semibold sm:text-center">
                            <p>{statusLabel(row)}</p>
                            <p className="text-xs text-foreground/60">
                                Updated {formatUpdated(row.updatedAt)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <Badge
                                variant={
                                    row.sectionComplete || row.phase3Complete
                                        ? "default"
                                        : "outline"
                                }
                            >
                                {row.sectionComplete || row.phase3Complete
                                    ? "Finished"
                                    : "In progress"}
                            </Badge>
                            <Badge variant="outline">Phase {row.currentPhase}</Badge>
                            <Badge variant="outline">Level {row.currentLevel}</Badge>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ScoreboardPage() {
    const { snapshot, loading, error } = useScoreboard();
    const [phaseTabs, setPhaseTabs] = useState<Record<string, string>>({});

    const gardenSections =
        snapshot?.garden.sections ??
        allSections.map((section) => ({
            sectionId: section.id,
            title: section.title,
            phases: section.phases.length,
            rows: [],
        }));

    const jailbreakRows: JailbreakScoreboardRow[] = snapshot?.jailbreak.rows ?? [];

    const lastSync =
        snapshot?.garden?.generatedAt ??
        snapshot?.jailbreak?.generatedAt;

    return (
        <div className="min-h-screen bg-background px-4 py-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-tight text-foreground/60">
                            Public view
                        </p>
                        <h1 className="text-3xl font-bold leading-tight">Live Scoreboard</h1>
                        <p className="max-w-2xl text-sm text-foreground/70">
                            Watch each seat advance through every section and phase. Updates stream
                            in real time—no refresh needed.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <LivePill label="Live" />
                        {lastSync && (
                            <span className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-xs font-semibold shadow-shadow">
                                Last sync {formatUpdated(lastSync)}
                            </span>
                        )}
                        {loading && (
                            <span className="inline-flex items-center gap-2 rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-xs font-semibold shadow-shadow">
                                <RefreshCw className="h-4 w-4 animate-spin" /> Connecting…
                            </span>
                        )}
                    </div>
                </header>

                {error && (
                    <div className="rounded-md border-4 border-destructive bg-secondary-background px-4 py-3 text-sm font-semibold text-destructive shadow-shadow">
                        {error}
                    </div>
                )}

                <Tabs defaultValue="garden" className="w-full">
                    <TabsList className="flex w-full flex-wrap gap-2 bg-secondary-background">
                        <TabsTrigger value="garden">Section 1 · Garden Builders</TabsTrigger>
                        <TabsTrigger value="jailbreak">Section 2 · Jailbreak Battle</TabsTrigger>
                    </TabsList>

                    <TabsContent value="garden" className="space-y-4">
                        {gardenSections.map((section) => (
                            <Card key={section.sectionId}>
                                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle>{section.title}</CardTitle>
                                        <CardDescription>
                                            Track every seat across {section.phases} phases.
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
                                        <RadioTower className="h-4 w-4" />
                                        Live updates every few seconds
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <PhaseTabs
                                        section={section}
                                        active={phaseTabs[section.sectionId] ?? "all"}
                                        onChange={(phase) =>
                                            setPhaseTabs((prev) => ({
                                                ...prev,
                                                [section.sectionId]: phase,
                                            }))
                                        }
                                    />
                                    <SectionTable
                                        section={section}
                                        phaseFilter={phaseTabs[section.sectionId] ?? "all"}
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="jailbreak" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Swords className="h-5 w-5" /> Jailbreak Battle
                                    </CardTitle>
                                    <CardDescription>
                                        Live attacker vs defender matches. Score favors fast
                                        breaches and solid patches.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
                                    <Zap className="h-4 w-4" />
                                    Auto-refreshing feed
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Match</TableHead>
                                                <TableHead>Attacker</TableHead>
                                                <TableHead>Defender</TableHead>
                                                <TableHead>Cracks</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {jailbreakRows.length === 0 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={6}
                                                        className="text-center text-sm"
                                                    >
                                                        No matches yet.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {jailbreakRows.map((row) => (
                                                <TableRow key={row.matchId}>
                                                    <TableCell className="font-semibold">
                                                        {row.matchId.slice(0, 6)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1 text-sm font-semibold">
                                                            <span>
                                                                Seat {row.attackerSeat ?? "—"}
                                                            </span>
                                                            <span className="text-xs text-foreground/70">
                                                                {row.attackerName ||
                                                                    row.attackerChildId}
                                                            </span>
                                                            <Badge variant="outline">
                                                                Score {row.attackerScore}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1 text-sm font-semibold">
                                                            <span>
                                                                Seat {row.defenderSeat ?? "—"}
                                                            </span>
                                                            <span className="text-xs text-foreground/70">
                                                                {row.defenderName ||
                                                                    row.defenderChildId}
                                                            </span>
                                                            <Badge variant="outline">
                                                                Score {row.defenderScore}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-semibold">
                                                        {row.cracksCompleted} / 3
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <Badge
                                                            variant={
                                                                row.status === "completed"
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                        >
                                                            {row.status ?? "active"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {formatUpdated(row.updatedAt)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
