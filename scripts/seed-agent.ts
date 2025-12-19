/**
 * Seed minimal agent staging data for Part 3 (hallucination -> tools -> defense).
 *
 * Run with: `pnpm dlx tsx scripts/seed-agent.ts`
 * Requires FIREBASE_ADMIN_* env vars.
 */
import { config as loadEnv } from "dotenv";
import { Timestamp } from "firebase-admin/firestore";

// Ensure local env (e.g., .env.local) is loaded when running via tsx
loadEnv({ path: ".env.local" });
loadEnv();

import type { Firestore } from "firebase-admin/firestore";
import { AgentKnowledgeDoc, AgentLevel, AgentStage } from "../lib/server/agent-types";

let adminFirestore: Firestore | undefined;

const stages: AgentStage[] = [
    {
        id: "stage-hallucination",
        stageType: "HALLUCINATION",
        title: "幻覺體驗",
        description: "沒有工具、容易亂編。",
        order: 1,
        requiresCueToUnlock: false,
        isActive: true,
    },
    {
        id: "stage-tools",
        stageType: "TOOLS",
        title: "工具啟用",
        description: "學會查證並少用 token。",
        order: 2,
        requiresCueToUnlock: true,
        unlockCueType: "unlock-agent-tools",
        isActive: true,
    },
    {
        id: "stage-defense",
        stageType: "DEFENSE",
        title: "防守關",
        description: "資料矛盾/過時，輸出需嚴格。",
        order: 3,
        requiresCueToUnlock: true,
        unlockCueType: "unlock-agent-defense",
        isActive: true,
    },
];

const levels: AgentLevel[] = [
    {
        id: "lvl-h1",
        stageType: "HALLUCINATION",
        order: 1,
        briefing: "不用工具回答這題，觀察會不會亂講。",
        taskPrompt: "請回答：西抗國的首都在哪裡？",
        allowedTools: [],
        expected: { judgeType: "EXACT", canonicalAnswer: "（本關預期失敗）" },
        maxSteps: 3,
        isActive: true,
        requiresCueAfterPass: false,
    },
    {
        id: "lvl-h3",
        stageType: "HALLUCINATION",
        order: 3,
        briefing: "最後一題後全班會暫停等講解。",
        taskPrompt: "說明『螺旋書院』的創辦年份。",
        allowedTools: [],
        expected: { judgeType: "EXACT", canonicalAnswer: "（本關預期失敗）" },
        maxSteps: 3,
        isActive: true,
        requiresCueAfterPass: true,
        postPassCueType: "pause-after-hallucination",
    },
    {
        id: "lvl-t1",
        stageType: "TOOLS",
        order: 4,
        briefing: "解鎖工具後，請查證再答。",
        taskPrompt: "查出『西抗國』的官方語言為何？需附來源 docId。",
        allowedTools: ["search_docs", "read_doc"],
        toolScopes: {
            search_docs: { allowedEntityKeys: ["westoria/lang"], maxResults: 3 },
            read_doc: { allowedDocIds: [] },
        },
        expected: { judgeType: "REFEREE_LLM", refereeCriteria: "答案需含 docId 且語言正確。" },
        maxSteps: 5,
        isActive: true,
    },
    {
        id: "lvl-d1",
        stageType: "DEFENSE",
        order: 7,
        briefing: "資料有新舊版本，請輸出 JSON 指定欄位。",
        taskPrompt: '請產出 JSON：{"language": string, "docId": string, "asOf": string}',
        allowedTools: ["search_docs", "read_doc", "query_fact"],
        toolScopes: {
            search_docs: { allowedEntityKeys: ["westoria/lang"], maxResults: 4 },
            read_doc: { allowedDocIds: [] },
            query_fact: { allowedEntityKeys: ["westoria/lang"], allowMultipleCandidates: true },
        },
        expected: {
            judgeType: "JSON_SCHEMA",
            jsonSchema: {
                type: "object",
                required: ["language", "docId", "asOf"],
                properties: {
                    language: { type: "string" },
                    docId: { type: "string" },
                    asOf: { type: "string" },
                },
            },
        },
        maxSteps: 6,
        isActive: true,
    },
];

const knowledgeDocs: AgentKnowledgeDoc[] = [
    {
        id: "westoria-lang-2021",
        entityKey: "westoria/lang",
        sourceTitle: "西抗國官方公告 2021",
        sourceTier: "trusted",
        publishedAt: Timestamp.fromDate(new Date("2021-03-01")),
        supersedesDocId: null,
        content: "西抗國官方語言為 西抗語（Westoric）。",
        facts: { language: "Westoric", asOf: "2021-03-01" },
    },
    {
        id: "westoria-lang-2024",
        entityKey: "westoria/lang",
        sourceTitle: "西抗國文化部 2024-07 更新",
        sourceTier: "trusted",
        publishedAt: Timestamp.fromDate(new Date("2024-07-15")),
        supersedesDocId: "westoria-lang-2021",
        content: "自 2024 年，官方語言改為 新西抗語（Neo-Westoric）。",
        facts: { language: "Neo-Westoric", asOf: "2024-07-15" },
    },
    {
        id: "westoria-lang-blog",
        entityKey: "westoria/lang",
        sourceTitle: "旅遊部落客亂寫",
        sourceTier: "untrusted",
        publishedAt: Timestamp.fromDate(new Date("2023-11-20")),
        supersedesDocId: null,
        content: "西抗國沒官方語言，大家都講英語。",
        facts: { language: "English", asOf: "2023-11-20" },
    },
];

async function initDb() {
    if (!adminFirestore) {
        const mod = await import("../lib/firebase-admin");
        adminFirestore = mod.adminFirestore;
    }
    if (!adminFirestore) {
        console.error("Missing FIREBASE_ADMIN_* env vars; cannot seed.");
        process.exit(1);
    }
    return adminFirestore;
}

async function main() {
    const db = await initDb();

    for (const stage of stages) {
        await db.collection("agentStages").doc(stage.id).set(stage, { merge: true });
        console.log(`Seeded stage ${stage.id}`);
    }

    for (const level of levels) {
        await db.collection("agentLevels").doc(level.id).set(level, { merge: true });
        console.log(`Seeded level ${level.id}`);
    }

    for (const doc of knowledgeDocs) {
        await db.collection("agentKnowledgeDocs").doc(doc.id).set(doc, { merge: true });
        console.log(`Seeded knowledge doc ${doc.id}`);
    }

    console.log("Agent seed complete");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
