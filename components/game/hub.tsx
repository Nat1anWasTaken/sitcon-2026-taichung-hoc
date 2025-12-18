"use client";

import { Loader2, Rabbit, Shield, Sword, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionOneGame } from "@/components/game/section-one";
import { JailbreakBattle } from "@/components/game/jailbreak-battle";
import { AgentWarRoom } from "@/components/game/agent-war-room";

type Stage = "section-1" | "section-2" | "section-3";

export function GameHub() {
    const [loading, setLoading] = useState(true);
    const [stage, setStage] = useState<Stage>("section-1");
    const [sectionComplete, setSectionComplete] = useState(false);
    const [startSection2, setStartSection2] = useState(false);
    const [sectionTwoComplete, setSectionTwoComplete] = useState(false);
    const [sectionThreeOpen, setSectionThreeOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchState = async () => {
            try {
                const [progressRes, cuesRes, matchRes] = await Promise.all([
                    fetch("/api/game/progress/section-1", { credentials: "include" }),
                    fetch("/api/game/cues", { credentials: "include" }),
                    fetch("/api/jailbreak/match", { credentials: "include" }),
                ]);

                if (progressRes.ok) {
                    const prog = await progressRes.json();
                    setSectionComplete(!!prog.progress?.sectionComplete);
                }
                if (cuesRes.ok) {
                    const cueData = await cuesRes.json();
                    const activeCues: { id: string }[] = cueData.cues ?? [];
                    setStartSection2(activeCues.some((c) => c.id === "start-section-2"));
                    setSectionThreeOpen(
                        activeCues.some(
                            (c) => c.id === "unlock-agent-tools" || c.id === "unlock-agent-defense"
                        )
                    );
                }
                if (matchRes.ok) {
                    const { match } = await matchRes.json();
                    const status = match?.status ?? match?.currentPhase;
                    setSectionTwoComplete(status === "completed" || status === "COMPLETED");
                }
            } catch (err) {
                console.error("Failed to load hub state", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchState();
        const id = setInterval(fetchState, 3000);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    useEffect(() => {
        if (sectionComplete && startSection2) {
            if (sectionTwoComplete && sectionThreeOpen) {
                setStage("section-3");
                return;
            }
            setStage("section-2");
        }
        if (!sectionComplete) setStage("section-1");
    }, [sectionComplete, startSection2, sectionTwoComplete, sectionThreeOpen]);

    const stageLabel = useMemo(() => {
        if (stage === "section-3") return "Section 3 · Agent War Room";
        if (stage === "section-2") return "Section 2 · Jailbreak Battle";
        return "Section 1 · Garden Builders";
    }, [stage]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="inline-flex items-center gap-2 rounded-md border-4 border-foreground bg-secondary-background px-4 py-2 font-semibold shadow-shadow">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading game…
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background px-4 py-8">
            <Card className="mb-6 border-4 border-foreground shadow-shadow">
                <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm font-semibold">
                    <Badge variant="outline" className="border-2">
                        {stageLabel}
                    </Badge>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-tight text-foreground/70">
                        {stage === "section-1" ? (
                            <>
                                <WandSparkles className="h-4 w-4" />
                                Complete Section 1 to unlock the next battle.
                            </>
                        ) : (
                            <>
                                <Sword className="h-4 w-4" />
                                Section 2 unlocked by admin cue.
                            </>
                        )}
                    </div>
                    <div className="flex-1" />
                    <Badge variant={sectionComplete ? "default" : "outline"} className="border-2">
                        {sectionComplete ? "Section 1 done" : "Section 1 in progress"}
                    </Badge>
                    <Badge variant={startSection2 ? "default" : "outline"} className="border-2">
                        {startSection2 ? "Section 2 open" : "Awaiting Section 2 cue"}
                    </Badge>
                    <Badge
                        variant={sectionTwoComplete ? "default" : "outline"}
                        className="border-2"
                    >
                        {sectionTwoComplete ? "Section 2 done" : "Section 2 in progress"}
                    </Badge>
                    <Badge variant={sectionThreeOpen ? "default" : "outline"} className="border-2">
                        {sectionThreeOpen ? "Section 3 open" : "Awaiting Agent cue"}
                    </Badge>
                </CardContent>
            </Card>

            {stage === "section-1" ? (
                <SectionOneGame onSectionComplete={() => setSectionComplete(true)} />
            ) : stage === "section-2" ? (
                <JailbreakBattle />
            ) : (
                <AgentWarRoom />
            )}
        </div>
    );
}
