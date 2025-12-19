"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useCues } from "@/hooks/use-cues";
import { setCueActive } from "@/lib/cues-client";

const cueCatalog = [
    {
        id: "start-phase-3",
        title: "Start Phase 3",
        description: "Unlocks the final quest for all kids who finished phases 1 & 2.",
    },
    {
        id: "unlock-bonus-blocks",
        title: "Unlock bonus blocks",
        description: "Adds extra descriptive blocks during Phase 1.",
    },
    {
        id: "start-section-2",
        title: "Start Section 2 (Jailbreak)",
        description: "Allows kids to enter the Section 2 Jailbreak Battle.",
    },
    {
        id: "unlock-agent-tools",
        title: "解鎖工具階段",
        description: "讓第三部份 Agent 啟用工具關卡。",
    },
    {
        id: "unlock-agent-defense",
        title: "解鎖防守階段",
        description: "讓第三部份 Agent 進入防守關。",
    },
];

export default function CuesPage() {
    const { cues, loading, refresh } = useCues();
    const [busyId, setBusyId] = useState<string | null>(null);

    const getCueActive = (id: string) => cues.find((c) => c.id === id)?.active ?? false;

    const handleToggle = async (id: string, active: boolean) => {
        setBusyId(id);
        try {
            await setCueActive(id, active);
            await refresh();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 font-semibold shadow-shadow">
                    <Sparkles className="mr-2 inline h-4 w-4" />
                    Admin cues
                </div>
                <div className="text-lg font-bold">Control unlocks and pacing</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {cueCatalog.map((cue) => {
                    const active = getCueActive(cue.id);
                    return (
                        <Card key={cue.id}>
                            <CardHeader className="flex flex-row items-start justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-lg">{cue.title}</CardTitle>
                                    <CardDescription>{cue.description}</CardDescription>
                                </div>
                                <Switch
                                    checked={active}
                                    disabled={busyId === cue.id}
                                    onCheckedChange={(v) => handleToggle(cue.id, v)}
                                />
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <div className="text-sm text-foreground/80">
                                    {loading ? "Loading…" : active ? "Active" : "Inactive"}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggle(cue.id, !active)}
                                    disabled={busyId === cue.id}
                                >
                                    {active ? "Deactivate" : "Activate"}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
