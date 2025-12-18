import { AgentRunUsage } from "./agent-types";

export function estimateTokens(prompt: string, answer: string, steps: number): AgentRunUsage {
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(answer.length / 4);
    const totalTokens = inputTokens + outputTokens + steps * 6;
    return { inputTokens, outputTokens, totalTokens };
}

export function computeScore(totalTokens: number) {
    return Math.floor(1_000_000 / (Math.max(totalTokens, 1) + 1));
}
