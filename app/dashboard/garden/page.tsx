"use client";

import { LayoutDashboard, Loader2, Pencil, Plus, RotateCcw, Sprout, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useGardenContent } from "@/hooks/use-garden";
import {
    createGardenLevel,
    createGardenPhase,
    deleteGardenLevel,
    deleteGardenPhase,
    resetGardenToSeed,
    updateGardenLevel,
    updateGardenPhase,
} from "@/lib/garden-admin";
import { GardenLevel, GardenPhase } from "@/lib/garden-types";

const MAX_PHASES = 3;

function toList(value: string) {
    return value
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean);
}

export default function GardenAdminPage() {
    const { phases, levels, loading, refresh } = useGardenContent();

    const [phaseForm, setPhaseForm] = useState({
        title: "",
        mode: "blocks" as GardenPhase["mode"],
        description: "",
        order: 1,
        lockedByCue: "",
    });
    const [levelForm, setLevelForm] = useState({
        phaseId: "",
        levelNumber: 1,
        target: "",
        blocks: "",
        bonusBlocks: "",
        hint: "",
    });

    const [editingPhase, setEditingPhase] = useState<GardenPhase | null>(null);
    const [editingLevel, setEditingLevel] = useState<GardenLevel | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busyPhase, startBusyPhase] = useTransition();
    const [busyLevel, startBusyLevel] = useTransition();
    const [busyReset, setBusyReset] = useState(false);

    useEffect(() => {
        if (!editingPhase) return;
        setPhaseForm({
            title: editingPhase.title,
            mode: editingPhase.mode,
            description: editingPhase.description ?? "",
            order: editingPhase.order,
            lockedByCue: editingPhase.lockedByCue ?? "",
        });
    }, [editingPhase]);

    useEffect(() => {
        if (!editingLevel) return;
        setLevelForm({
            phaseId: editingLevel.phaseId,
            levelNumber: editingLevel.levelNumber,
            target: editingLevel.target,
            blocks: (editingLevel.blocks ?? []).join("\n"),
            bonusBlocks: (editingLevel.bonusBlocks ?? []).join("\n"),
            hint: editingLevel.hint ?? "",
        });
    }, [editingLevel]);

    const sortedPhases = useMemo(() => [...phases].sort((a, b) => a.order - b.order), [phases]);

    const groupedLevels = useMemo(() => {
        return sortedPhases.map((phase) => ({
            phase,
            levels: levels
                .filter((lvl) => lvl.phaseId === phase.id)
                .sort((a, b) => a.levelNumber - b.levelNumber),
        }));
    }, [levels, sortedPhases]);

    useEffect(() => {
        setPhaseForm((prev) => ({ ...prev, order: phases.length + 1 }));
        if (!levelForm.phaseId && phases.length) {
            setLevelForm((prev) => ({ ...prev, phaseId: phases[0].id }));
        }
    }, [levelForm.phaseId, phases]);

    const handlePhaseSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        startBusyPhase(async () => {
            try {
                const orderClash = phases.some(
                    (p) =>
                        p.order === phaseForm.order && (!editingPhase || p.id !== editingPhase.id)
                );
                if (orderClash) {
                    setMessage("每個階段需要唯一的順序編號。請選擇不同的順序。");
                    return;
                }

                if (!editingPhase && phases.length >= MAX_PHASES) {
                    setMessage("第 1 部分僅支援三個階段。請編輯現有階段。");
                    return;
                }

                if (editingPhase) {
                    await updateGardenPhase(editingPhase.id, {
                        ...phaseForm,
                        lockedByCue: phaseForm.lockedByCue.trim(),
                    });
                    setMessage("階段已更新。");
                } else {
                    await createGardenPhase({
                        ...phaseForm,
                        lockedByCue: phaseForm.lockedByCue.trim(),
                    });
                    setMessage("已建立階段。");
                }
                setEditingPhase(null);
                setPhaseForm({
                    title: "",
                    mode: "blocks",
                    description: "",
                    order: phases.length + 1,
                    lockedByCue: "",
                });
                await refresh();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "儲存階段失敗";
                setMessage(msg);
            }
        });
    };

    const handlePhaseDelete = async (phaseId: string) => {
        const confirmDelete = window.confirm("是否刪除此階段及其關卡？");
        if (!confirmDelete) return;
        setMessage(null);
        setBusyReset(true);
        try {
            await deleteGardenPhase(phaseId);
            setEditingPhase(null);
            setMessage("階段已刪除。");
            await refresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "刪除階段失敗";
            setMessage(msg);
        } finally {
            setBusyReset(false);
        }
    };

    const handleLevelSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        startBusyLevel(async () => {
            try {
                const payload = {
                    phaseId: levelForm.phaseId,
                    levelNumber: levelForm.levelNumber,
                    target: levelForm.target,
                    blocks: toList(levelForm.blocks),
                    bonusBlocks: toList(levelForm.bonusBlocks),
                    hint: levelForm.hint,
                };
                if (editingLevel) {
                    await updateGardenLevel(editingLevel.id, payload);
                    setMessage("關卡已更新。");
                } else {
                    await createGardenLevel(payload);
                    setMessage("已建立關卡。");
                }
                setEditingLevel(null);
                setLevelForm((prev) => ({
                    phaseId: prev.phaseId || phases[0]?.id || "",
                    levelNumber: 1,
                    target: "",
                    blocks: "",
                    bonusBlocks: "",
                    hint: "",
                }));
                await refresh();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "儲存關卡失敗";
                setMessage(msg);
            }
        });
    };

    const handleLevelDelete = async (levelId: string) => {
        const confirmDelete = window.confirm("是否刪除此關卡？");
        if (!confirmDelete) return;
        setMessage(null);
        setBusyReset(true);
        try {
            await deleteGardenLevel(levelId);
            setEditingLevel(null);
            setMessage("關卡已刪除。");
            await refresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "刪除關卡失敗";
            setMessage(msg);
        } finally {
            setBusyReset(false);
        }
    };

    const handleReset = async () => {
        const confirmReset = window.confirm("是否以預設範例取代所有階段與關卡？");
        if (!confirmReset) return;
        setBusyReset(true);
        setMessage(null);
        try {
            await resetGardenToSeed();
            setMessage("已載入範例內容。");
            await refresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "重設內容失敗";
            setMessage(msg);
        } finally {
            setBusyReset(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 font-semibold shadow-shadow">
                    <LayoutDashboard className="mr-2 inline h-4 w-4" />第 1 部分 · 管理員
                </div>
                <div className="text-lg font-bold">圖片生成關卡</div>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>階段</CardTitle>
                        <CardDescription>
                            第 1
                            部分支援三個階段。編輯現有階段；超出三個的新增階段將不會被遊戲讀取。
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Sprout className="h-4 w-4" />
                        資料驅動
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                        允許的階段數：{phases.length}/{MAX_PHASES}。遊戲僅讀取第 1 部分的三個階段。
                    </div>
                    <form className="grid gap-4 lg:grid-cols-5" onSubmit={handlePhaseSubmit}>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>標題</Label>
                            <Input
                                required
                                value={phaseForm.title}
                                onChange={(e) =>
                                    setPhaseForm({ ...phaseForm, title: e.target.value })
                                }
                                placeholder="Prompt 區塊"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>模式</Label>
                            <Select
                                value={phaseForm.mode}
                                onValueChange={(val) =>
                                    setPhaseForm({ ...phaseForm, mode: val as GardenPhase["mode"] })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="blocks">區塊</SelectItem>
                                    <SelectItem value="text">文字</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>順序</Label>
                            <Input
                                type="number"
                                min={1}
                                value={phaseForm.order}
                                onChange={(e) =>
                                    setPhaseForm({ ...phaseForm, order: Number(e.target.value) })
                                }
                            />
                            <p className="text-xs font-semibold text-foreground/70">
                                順序必須唯一；重複的順序會被拒絕。
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>由 Prompt 鎖定（可選）</Label>
                            <Input
                                value={phaseForm.lockedByCue}
                                onChange={(e) =>
                                    setPhaseForm({ ...phaseForm, lockedByCue: e.target.value })
                                }
                                placeholder="start-phase-3"
                            />
                        </div>
                        <div className="lg:col-span-3 space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                rows={2}
                                value={phaseForm.description}
                                onChange={(e) =>
                                    setPhaseForm({ ...phaseForm, description: e.target.value })
                                }
                                placeholder="說明此階段的目標"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button
                                type="submit"
                                disabled={
                                    busyPhase || (!editingPhase && phases.length >= MAX_PHASES)
                                }
                                className="w-full lg:w-auto"
                            >
                                {busyPhase ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        儲存中
                                    </>
                                ) : editingPhase ? (
                                    <>
                                        <Pencil className="h-4 w-4" />
                                        更新階段
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        新增階段
                                    </>
                                )}
                            </Button>
                            {editingPhase && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingPhase(null);
                                        setPhaseForm({
                                            title: "",
                                            mode: "blocks",
                                            description: "",
                                            order: phases.length + 1,
                                            lockedByCue: "",
                                        });
                                    }}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Locked by Cue</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedPhases.map((phase) => (
                                <TableRow key={phase.id}>
                                    <TableCell className="font-semibold">{phase.order}</TableCell>
                                    <TableCell>{phase.title}</TableCell>
                                    <TableCell className="capitalize">{phase.mode}</TableCell>
                                    <TableCell>{phase.lockedByCue || "—"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setEditingPhase(phase)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handlePhaseDelete(phase.id)}
                                                disabled={busyReset}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!sortedPhases.length && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center font-semibold">
                                        尚無階段。
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>關卡</CardTitle>
                        <CardDescription>管理每個階段的目標與可選提示區塊。</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={handleReset} disabled={busyReset}>
                            {busyReset ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    重置中
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-4 w-4" />
                                    載入預設內容
                                </>
                            )}
                        </Button>
                        <Badge variant="outline">即時同步</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleLevelSubmit}>
                        <div className="space-y-2">
                            <Label>階段</Label>
                            <Select
                                value={levelForm.phaseId}
                                onValueChange={(val) =>
                                    setLevelForm({ ...levelForm, phaseId: val })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="選擇階段" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortedPhases.map((phase) => (
                                        <SelectItem key={phase.id} value={phase.id}>
                                            {phase.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>順序</Label>
                            <Input
                                type="number"
                                min={1}
                                value={levelForm.levelNumber}
                                onChange={(e) =>
                                    setLevelForm({
                                        ...levelForm,
                                        levelNumber: Number(e.target.value),
                                    })
                                }
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>目標</Label>
                            <Input
                                required
                                value={levelForm.target}
                                onChange={(e) =>
                                    setLevelForm({ ...levelForm, target: e.target.value })
                                }
                                placeholder="描述希望的圖像"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>區塊（每行一個或以逗號分隔）</Label>
                            <Textarea
                                rows={3}
                                value={levelForm.blocks}
                                onChange={(e) =>
                                    setLevelForm({ ...levelForm, blocks: e.target.value })
                                }
                                placeholder="Generate\na cute rabbit"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>加分區塊（可選）</Label>
                            <Textarea
                                rows={3}
                                value={levelForm.bonusBlocks}
                                onChange={(e) =>
                                    setLevelForm({ ...levelForm, bonusBlocks: e.target.value })
                                }
                                placeholder="soft lighting\nwide angle"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>提示（可選）</Label>
                            <Textarea
                                rows={2}
                                value={levelForm.hint}
                                onChange={(e) =>
                                    setLevelForm({ ...levelForm, hint: e.target.value })
                                }
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button
                                type="submit"
                                disabled={busyLevel || !levelForm.phaseId}
                                className="w-full lg:w-auto"
                            >
                                {busyLevel ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        儲存中
                                    </>
                                ) : editingLevel ? (
                                    <>
                                        <Pencil className="h-4 w-4" />
                                        更新關卡
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        新增關卡
                                    </>
                                )}
                            </Button>
                            {editingLevel && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingLevel(null);
                                        setLevelForm((prev) => ({
                                            phaseId: prev.phaseId || phases[0]?.id || "",
                                            levelNumber: 1,
                                            target: "",
                                            blocks: "",
                                            bonusBlocks: "",
                                            hint: "",
                                        }));
                                    }}
                                >
                                    取消
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="space-y-4">
                        {groupedLevels.map(({ phase, levels: phaseLevels }) => (
                            <div
                                key={phase.id}
                                className="rounded-md border-4 border-foreground bg-secondary-background p-4 shadow-shadow"
                            >
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="font-bold">
                                        {phase.title}{" "}
                                        <span className="text-sm font-semibold text-foreground/60">
                                            (order {phase.order})
                                        </span>
                                    </div>
                                    <Badge variant="outline">{phaseLevels.length} level(s)</Badge>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-20">Order</TableHead>
                                            <TableHead>Target</TableHead>
                                            <TableHead>Blocks</TableHead>
                                            <TableHead>Bonus</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {phaseLevels.map((lvl) => (
                                            <TableRow key={lvl.id}>
                                                <TableCell className="font-semibold">
                                                    {lvl.levelNumber}
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    {lvl.target}
                                                </TableCell>
                                                <TableCell className="text-xs text-foreground/80">
                                                    {(lvl.blocks ?? []).join(", ") || "—"}
                                                </TableCell>
                                                <TableCell className="text-xs text-foreground/80">
                                                    {(lvl.bonusBlocks ?? []).join(", ") || "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => setEditingLevel(lvl)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                handleLevelDelete(lvl.id)
                                                            }
                                                            disabled={busyReset}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {!phaseLevels.length && (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
                                                    className="text-center font-semibold"
                                                >
                                                    尚無此階段的關卡。
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                        {!groupedLevels.length && !loading && (
                            <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                                請先新增一個階段以開始。
                            </div>
                        )}
                    </div>

                    {message && (
                        <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                            {message}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
