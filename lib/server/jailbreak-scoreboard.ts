import { JailbreakScoreboardRow } from "../jailbreak-scoreboard-types";
import { connectToDatabase } from "../mongodb";
import { JailbreakMatchModel, IJailbreakMatch } from "../models/jailbreak-match";
import { ChildModel, IChild } from "../models/child";

export async function buildJailbreakScoreboard(): Promise<{
    generatedAt: string;
    rows: JailbreakScoreboardRow[];
}> {
    await connectToDatabase();

    const [matches, children] = await Promise.all([
        JailbreakMatchModel.find({}).sort({ updatedAt: -1 }).limit(50).lean<IJailbreakMatch[]>(),
        ChildModel.find({}).lean<IChild[]>(),
    ]);

    const childMap = new Map(children.map((child) => [child._id, child]));

    const rows: JailbreakScoreboardRow[] = matches.map((match) => {
        const attacker = childMap.get(match.attackerChildId);
        const defender = childMap.get(match.defenderChildId);
        const updatedAt = match.updatedAt?.toISOString?.();

        return {
            matchId: match.id ?? match._id,
            attackerChildId: match.attackerChildId,
            defenderChildId: match.defenderChildId,
            attackerSeat: attacker?.seatNumber ?? match.attackerSeat,
            defenderSeat: defender?.seatNumber ?? match.defenderSeat,
            attackerName: attacker?.name ?? match.attackerName ?? null,
            defenderName: defender?.name ?? match.defenderName ?? null,
            themeTitle: match.themeTitle,
            cracksCompleted: match.cracksCompleted ?? 0,
            attackerScore: match.attackerScore ?? 0,
            defenderScore: match.defenderScore ?? 0,
            status: match.status,
            updatedAt: updatedAt ?? new Date().toISOString(),
        } satisfies JailbreakScoreboardRow;
    });

    rows.sort((a, b) => b.attackerScore - a.attackerScore || (b.updatedAt > a.updatedAt ? 1 : -1));

    const generatedAt = new Date().toISOString();

    return { generatedAt, rows };
}
