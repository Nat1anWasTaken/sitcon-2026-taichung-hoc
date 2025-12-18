import { AgentLevel } from "./agent-types";
import { runJudge } from "./agent-judge";
import { estimateTokens } from "./agent-scoring";
import { queryFact, readDoc, searchDocs, ToolExecution, ToolScope } from "./agent-tools";

export type AgentEngineResult = {
    events: ToolExecution[];
    finalAnswer: string;
    finalAnswerJson?: unknown;
    passed: boolean;
    failureReason?: string;
    usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

function pickLatestTrusted(docs: Awaited<ReturnType<typeof searchDocs>>["docs"]) {
    const trusted = docs.filter((d) => d.sourceTier === "trusted");
    const pool = trusted.length ? trusted : docs;
    return pool.sort((a, b) => b.publishedAt.toMillis() - a.publishedAt.toMillis())[0];
}

export async function runLevelEngine(params: {
    level: AgentLevel;
    prompt: string;
}): Promise<AgentEngineResult> {
    const { level, prompt } = params;
    const events: ToolExecution[] = [];
    let finalAnswer = "";
    let finalAnswerJson: unknown;

    const scope: Record<string, ToolScope | undefined> = level.toolScopes ?? {};

    // Hallucination stage: do not call tools, intentionally fuzzy answer
    if (!level.allowedTools.length) {
        finalAnswer = "我猜測答案可能是：不知道或隨便亂講。";
    } else {
        const entityKey =
            (scope.search_docs as { allowedEntityKeys?: string[] } | undefined)?.allowedEntityKeys?.[0] ??
            "westoria/lang";
        let chosenDocId: string | undefined;

        if (level.allowedTools.includes("search_docs")) {
            const { events: e, docs } = await searchDocs(entityKey, scope.search_docs);
            events.push(...e);
            const picked = pickLatestTrusted(docs);
            chosenDocId = picked?.id;
        }

        if (chosenDocId && level.allowedTools.includes("read_doc")) {
            const { events: e, doc } = await readDoc(chosenDocId, scope.read_doc);
            events.push(...e);
            if (doc) {
                finalAnswer = `${doc.content.slice(0, 120)} (docId=${doc.id})`;
            }
        }

        if (!finalAnswer && level.allowedTools.includes("query_fact")) {
            const { events: e, candidates } = await queryFact(entityKey, scope.query_fact);
            events.push(...e);
            const first = candidates[0];
            if (first) {
                finalAnswer = `${first.value} (docId=${first.docId ?? "unknown"})`;
                if (typeof first.value === "object") finalAnswerJson = first.value;
            }
        }
    }

    // Attempt JSON parse for schema judge
    if (!finalAnswerJson) {
        try {
            finalAnswerJson = JSON.parse(finalAnswer);
        } catch {
            finalAnswerJson = undefined;
        }
    }

    const judge = runJudge(level.expected.judgeType, level.expected, finalAnswer, finalAnswerJson);

    const usage = estimateTokens(prompt, finalAnswer, events.length);

    return {
        events,
        finalAnswer,
        finalAnswerJson,
        passed: judge.passed,
        failureReason: judge.failureReason,
        usage,
    };
}
