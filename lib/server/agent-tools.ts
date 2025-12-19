import { AgentKnowledgeDoc } from "./agent-types";
import { getKnowledgeDoc, listKnowledgeDocsForEntity } from "./agent-store";

export type ToolExecution =
    | {
          type: "tool_call";
          name: string;
          params: Record<string, unknown>;
      }
    | { type: "tool_result"; name: string; result: unknown };

export type ToolScope =
    | { allowedEntityKeys: string[]; maxResults?: number }
    | { allowedDocIds: string[] }
    | Record<string, unknown>;

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

function enforceEntity(scope: ToolScope | undefined, entityKey: string) {
    const allowed = (scope as { allowedEntityKeys?: string[] } | undefined)?.allowedEntityKeys;
    if (allowed && !allowed.includes(entityKey)) {
        throw new Error("Entity not allowed for this level");
    }
}

function enforceDoc(scope: ToolScope | undefined, docId: string) {
    const allowed = (scope as { allowedDocIds?: string[] } | undefined)?.allowedDocIds;
    if (allowed && allowed.length && !allowed.includes(docId)) {
        throw new Error("Doc not allowed for this level");
    }
}

export async function searchDocs(
    entityKey: string,
    scope?: ToolScope
): Promise<{ events: ToolExecution[]; docs: AgentKnowledgeDoc[] }> {
    enforceEntity(scope, entityKey);
    const maxResults = (scope as { maxResults?: number } | undefined)?.maxResults ?? 5;
    const docs = await listKnowledgeDocsForEntity(entityKey);
    const trimmed = docs.slice(0, maxResults);
    const events: ToolExecution[] = [
        { type: "tool_call", name: "search_docs", params: { entityKey, limit: maxResults } },
        {
            type: "tool_result",
            name: "search_docs",
            result: trimmed.map((d) => ({
                docId: d.id,
                sourceTitle: d.sourceTitle,
                sourceTier: d.sourceTier,
                publishedAt: coerceDate(d.publishedAt),
                supersedesDocId: d.supersedesDocId ?? null,
            })),
        },
    ];
    return { events, docs: trimmed };
}

export async function readDoc(
    docId: string,
    scope?: ToolScope
): Promise<{ events: ToolExecution[]; doc: AgentKnowledgeDoc | null }> {
    enforceDoc(scope, docId);
    const doc = await getKnowledgeDoc(docId);
    const events: ToolExecution[] = [
        { type: "tool_call", name: "read_doc", params: { docId } },
        {
            type: "tool_result",
            name: "read_doc",
            result: doc
                ? {
                      docId: doc.id,
                      content: doc.content.slice(0, 600),
                      sourceTitle: doc.sourceTitle,
                      sourceTier: doc.sourceTier,
                      publishedAt: coerceDate(doc.publishedAt),
                  }
                : null,
        },
    ];
    return { events, doc: doc ?? null };
}

export async function queryFact(
    entityKey: string,
    scope?: ToolScope
): Promise<{
    events: ToolExecution[];
    candidates: Array<{ value: unknown; asOf?: string; docId?: string }>;
}> {
    enforceEntity(scope, entityKey);
    const docs = await listKnowledgeDocsForEntity(entityKey);
    const candidates = docs.map((d) => ({
        value: d.facts?.language ?? d.facts ?? d.content,
        asOf: (d.facts as { asOf?: string } | undefined)?.asOf,
        docId: d.id,
    }));
    const events: ToolExecution[] = [
        { type: "tool_call", name: "query_fact", params: { entityKey } },
        { type: "tool_result", name: "query_fact", result: candidates },
    ];
    return { events, candidates };
}
