import { connectToDatabase } from "../mongodb";
import { AgentRunModel, IAgentRun } from "../models/agent-run";
import { ChildModel, IChild } from "../models/child";
import { AgentScoreboardRow } from "../agent-types";

export async function buildAgentScoreboard() {
    await connectToDatabase();
    const runs = await AgentRunModel.find({ passed: true }).lean<IAgentRun[]>();
    const children = await ChildModel.find({}).lean<IChild[]>();
    const childMap = new Map(children.map((child) => [child._id, child]));

    const rows: AgentScoreboardRow[] = runs.map((run) => {
        const child = childMap.get(run.childId);
        const totalTokens: number = run.usage?.totalTokens ?? 0;
        const score = Math.floor(1_000_000 / (Math.max(totalTokens, 1) + 1));
        return {
            childId: run.childId,
            seatNumber: child?.seatNumber ?? 0,
            name: child?.name ?? "",
            levelId: run.levelId,
            stageType: run.stageType,
            totalTokens,
            score,
            bestForLevel: run.bestForLevel ?? false,
        };
    });

    rows.sort((a, b) => b.score - a.score || a.totalTokens - b.totalTokens);

    const generatedAt = new Date().toISOString();

    return { generatedAt, rows };
}
