"use server";

import { revalidatePath } from "next/cache";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminFirestore } from "@/lib/firebase-admin";
import { AgentLevel, AgentStage } from "@/lib/server/agent-types";

async function fetchData() {
    if (!adminFirestore) throw new Error("Missing admin credentials");
    const stagesSnap = await adminFirestore.collection("agentStages").get();
    const stages: AgentStage[] = stagesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentStage) }));
    const levelsSnap = await adminFirestore.collection("agentLevels").orderBy("order", "asc").get();
    const levels: AgentLevel[] = levelsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentLevel) }));
    return { stages, levels };
}

async function createLevel(formData: FormData) {
    "use server";
    if (!adminFirestore) throw new Error("Missing admin credentials");
    const id = String(formData.get("id") ?? "").trim();
    const stageType = String(formData.get("stageType") ?? "").trim();
    const order = Number(formData.get("order") ?? 1);
    const briefing = String(formData.get("briefing") ?? "");
    const taskPrompt = String(formData.get("taskPrompt") ?? "");
    if (!id || !stageType) throw new Error("id and stageType are required");
    const payload: AgentLevel = {
        id,
        stageType,
        order,
        briefing,
        taskPrompt,
        allowedTools: [],
        expected: { judgeType: "EXACT", canonicalAnswer: "" },
        maxSteps: 5,
        isActive: true,
    };
    await adminFirestore.collection("agentLevels").doc(id).set(payload, { merge: true });
    revalidatePath("/dashboard/agent/levels");
}

export default async function AgentLevelsPage() {
    const { stages, levels } = await fetchData();
    return (
        <div className="space-y-6">
            <Card className="border-4 border-foreground bg-secondary-background shadow-shadow">
                <CardHeader>
                    <CardTitle className="text-xl">Agent Levels</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                    {levels.map((lvl) => (
                        <div
                            key={lvl.id}
                            className="rounded-md border-4 border-foreground bg-background px-3 py-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">
                                    {lvl.id} · order {lvl.order}
                                </div>
                                <div className="text-xs uppercase">{lvl.stageType}</div>
                            </div>
                            <div className="text-sm">{lvl.briefing}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                                {lvl.taskPrompt}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-4 border-foreground bg-background shadow-shadow">
                <CardHeader>
                    <CardTitle className="text-lg">Quick add level</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={createLevel} className="space-y-3">
                        <div className="grid gap-2">
                            <Label htmlFor="id">Level ID</Label>
                            <Input name="id" id="id" required placeholder="lvl-x" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="stageType">Stage Type</Label>
                            <Input
                                name="stageType"
                                id="stageType"
                                required
                                placeholder="HALLUCINATION | TOOLS | DEFENSE"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="order">Order</Label>
                            <Input name="order" id="order" type="number" defaultValue={levels.length + 1} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="briefing">Briefing</Label>
                            <Textarea name="briefing" id="briefing" rows={2} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="taskPrompt">Task Prompt</Label>
                            <Textarea name="taskPrompt" id="taskPrompt" rows={3} />
                        </div>
                        <button
                            type="submit"
                            className="rounded-md border-4 border-foreground bg-secondary px-3 py-2 text-sm font-semibold shadow-shadow"
                        >
                            Save
                        </button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
