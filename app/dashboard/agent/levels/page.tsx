"use server";

import { revalidatePath } from "next/cache";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { connectToDatabase } from "@/lib/mongodb";
import { AgentLevelModel, IAgentLevel } from "@/lib/models/agent-level";
import { AgentStageModel, IAgentStage } from "@/lib/models/agent-stage";
import { AgentLevel, AgentStage, AgentStageType } from "@/lib/server/agent-types";

async function fetchData() {
    await connectToDatabase();
    const [stageDocs, levelDocs] = await Promise.all([
        AgentStageModel.find({}).sort({ order: 1 }).lean<IAgentStage[]>(),
        AgentLevelModel.find({}).sort({ order: 1 }).lean<IAgentLevel[]>(),
    ]);
    const stages = stageDocs.map((doc) => ({ ...(doc as AgentStage), id: doc.id ?? doc._id }));
    const levels = levelDocs.map((doc) => ({ ...(doc as AgentLevel), id: doc.id ?? doc._id }));
    return { stages, levels };
}

async function createLevel(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    const stageType = String(formData.get("stageType") ?? "").trim() as AgentStageType;
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
    await connectToDatabase();
    await AgentLevelModel.updateOne(
        { _id: id },
        {
            $set: { ...payload, id },
            $setOnInsert: { _id: id },
        },
        { upsert: true }
    );
    revalidatePath("/dashboard/agent/levels");
}

export default async function AgentLevelsPage() {
    const { levels } = await fetchData();
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
                            <Input
                                name="order"
                                id="order"
                                type="number"
                                defaultValue={levels.length + 1}
                            />
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
