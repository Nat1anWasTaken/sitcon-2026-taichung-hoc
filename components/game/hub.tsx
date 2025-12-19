"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { JailbreakBattle } from "@/components/game/jailbreak-battle";
import { SectionOneGame } from "@/components/game/section-one";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Stage = "section-1" | "section-2";

export function GameHub() {
    const [loading, setLoading] = useState(true);
    const [stage, setStage] = useState<Stage>("section-1");
    const [sectionComplete, setSectionComplete] = useState(false);
    const [startSection2, setStartSection2] = useState(false);
    const [sectionTwoComplete, setSectionTwoComplete] = useState(false);

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
            setStage("section-2");
        } else {
            setStage("section-1");
        }
    }, [sectionComplete, startSection2]);

    const stageLabel = useMemo(() => {
        if (stage === "section-2") return "第二單元 · 文字攻防對戰";
        return "第一單元 · 花園創建者";
    }, [stage]);

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4">
                <div className="inline-flex items-center gap-2 rounded-md border-4 border-foreground bg-secondary-background px-4 py-2 font-semibold shadow-shadow">
                    <Loader2 className="h-4 w-4 animate-spin" /> 載入遊戲…
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background px-4 py-8">
            <Card className="mb-6 border-4 border-foreground shadow-shadow">
                <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm font-semibold">
                    <Badge variant="outline" className="border-2">
                        {stageLabel}
                    </Badge>
                </CardContent>
            </Card>

            <div className="flex flex-1">
                {stage === "section-1" ? (
                    <SectionOneGame onSectionComplete={() => setSectionComplete(true)} />
                ) : (
                    <div className="flex-1">
                        <JailbreakBattle />
                    </div>
                )}
            </div>
        </div>
    );
}
