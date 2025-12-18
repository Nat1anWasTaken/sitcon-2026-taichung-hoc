import Ajv from "ajv";

import { AgentLevelExpected, JudgeType } from "./agent-types";

const ajv = new Ajv({ allErrors: true, coerceTypes: false, strict: false });

export type JudgeResult = {
    passed: boolean;
    failureReason?: string;
};

export function judgeExact(expected: AgentLevelExpected, answer: string): JudgeResult {
    const canonical = typeof expected.canonicalAnswer === "string" ? expected.canonicalAnswer : "";
    const passed = canonical && answer.trim() === canonical.trim();
    return {
        passed,
        failureReason: passed ? undefined : "WRONG_ANSWER",
    };
}

export function judgeJsonSchema(expected: AgentLevelExpected, json: unknown): JudgeResult {
    if (!expected.jsonSchema) return { passed: false, failureReason: "NO_SCHEMA" };
    const validate = ajv.compile(expected.jsonSchema as object);
    const ok = validate(json);
    return { passed: Boolean(ok), failureReason: ok ? undefined : "WRONG_FORMAT" };
}

export function judgeReferee(expected: AgentLevelExpected, answer: string): JudgeResult {
    // Lightweight heuristic in place of live LLM referee:
    const criteria = expected.refereeCriteria?.toLowerCase() ?? "";
    const needsDoc = criteria.includes("doc");
    const passed =
        answer.trim().length > 0 &&
        (!needsDoc || answer.toLowerCase().includes("doc") || answer.toLowerCase().includes("docid"));
    return { passed, failureReason: passed ? undefined : "WRONG_ANSWER" };
}

export function runJudge(
    judgeType: JudgeType,
    expected: AgentLevelExpected,
    finalAnswer: string,
    finalAnswerJson?: unknown
): JudgeResult {
    switch (judgeType) {
        case "EXACT":
            return judgeExact(expected, finalAnswer);
        case "JSON_SCHEMA":
            return judgeJsonSchema(expected, finalAnswerJson);
        case "REFEREE_LLM":
            return judgeReferee(expected, finalAnswer);
        default:
            return { passed: false, failureReason: "UNKNOWN_JUDGE" };
    }
}
