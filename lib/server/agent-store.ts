import { randomUUID } from "crypto";

import { connectToDatabase } from "../mongodb";
import { AgentKnowledgeDocModel, IAgentKnowledgeDoc } from "../models/agent-knowledge-doc";
import { AgentLevelModel, IAgentLevel } from "../models/agent-level";
import { AgentRunModel, IAgentRun } from "../models/agent-run";
import { AgentStageModel, IAgentStage } from "../models/agent-stage";
import { AgentKnowledgeDoc, AgentLevel, AgentRun, AgentStage, AgentStageType } from "./agent-types";

function coerceDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (typeof value === "object" && "toDate" in (value as object)) {
        const fn = (value as { toDate?: () => Date }).toDate;
        if (fn) return fn();
    }
    return undefined;
}

function withId<T extends { _id?: string; id?: string }>(doc: T) {
    const { _id, id, ...rest } = doc;
    return { ...rest, id: id ?? _id } as T & { id: string };
}

export async function listAgentStages(options?: { activeOnly?: boolean }): Promise<AgentStage[]> {
    await connectToDatabase();
    const filter = options?.activeOnly ? { isActive: true } : {};
    const stages = await AgentStageModel.find(filter).sort({ order: 1 }).lean<IAgentStage[]>();
    return stages.map((stage) => withId(stage) as unknown as AgentStage);
}

export async function listAgentLevelsByStage(
    stageType: AgentStageType,
    options?: { activeOnly?: boolean }
): Promise<AgentLevel[]> {
    await connectToDatabase();
    const filter = { stageType, ...(options?.activeOnly ? { isActive: true } : {}) };
    const levels = await AgentLevelModel.find(filter).sort({ order: 1 }).lean<IAgentLevel[]>();
    return levels.map((level) => withId(level) as unknown as AgentLevel);
}

export async function getAgentLevel(levelId: string): Promise<AgentLevel | null> {
    await connectToDatabase();
    const level = await AgentLevelModel.findById(levelId).lean<IAgentLevel | null>();
    if (!level) return null;
    return withId(level) as unknown as AgentLevel;
}

export async function getActiveLevel(levelId: string): Promise<AgentLevel> {
    const level = await getAgentLevel(levelId);
    if (!level || !level.isActive) throw new Error("Level not found or inactive");
    return level;
}

export async function listKnowledgeDocsForEntity(entityKey: string): Promise<AgentKnowledgeDoc[]> {
    await connectToDatabase();
    const docs = await AgentKnowledgeDocModel.find({ entityKey })
        .sort({ publishedAt: -1 })
        .lean<IAgentKnowledgeDoc[]>();
    return docs.map((doc) => withId(doc) as unknown as AgentKnowledgeDoc);
}

export async function getKnowledgeDoc(docId: string): Promise<AgentKnowledgeDoc | null> {
    await connectToDatabase();
    const doc = await AgentKnowledgeDocModel.findById(docId).lean<IAgentKnowledgeDoc | null>();
    if (!doc) return null;
    return withId(doc) as unknown as AgentKnowledgeDoc;
}

export async function recordAgentRun(run: Omit<AgentRun, "id">, runId?: string): Promise<string> {
    await connectToDatabase();
    const id = runId ?? randomUUID();
    const startedAt = coerceDate(run.startedAt) ?? new Date();
    const finishedAt = coerceDate(run.finishedAt) ?? new Date();
    const payload: IAgentRun = {
        ...(run as Omit<IAgentRun, "id" | "_id">),
        _id: id,
        id,
        startedAt,
        finishedAt,
    };
    await AgentRunModel.create(payload);
    return id;
}

export async function updateBestForLevel(levelId: string, childId: string) {
    await connectToDatabase();
    const bestRun = await AgentRunModel.findOne({
        levelId,
        childId,
        passed: true,
    })
        .sort({ "usage.totalTokens": 1 })
        .lean<IAgentRun | null>();

    const bestId = bestRun?._id ?? bestRun?.id;
    if (!bestId) return;

    await AgentRunModel.updateMany(
        { levelId, childId, passed: true },
        { $set: { bestForLevel: false } }
    );
    await AgentRunModel.updateOne({ _id: bestId }, { $set: { bestForLevel: true } });
}
