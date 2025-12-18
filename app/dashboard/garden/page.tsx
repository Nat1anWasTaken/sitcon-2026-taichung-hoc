"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import {
    LayoutDashboard,
    Loader2,
    Pencil,
    Plus,
    Sprout,
    RotateCcw,
    Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    const { phases, levels, loading } = useGardenContent();

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

    const sortedPhases = useMemo(
        () => [...phases].sort((a, b) => a.order - b.order),
        [phases]
    );

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
                if (!editingPhase && phases.length >= MAX_PHASES) {
                    setMessage("Only three phases are supported in Section 1. Edit an existing phase instead.");
                    return;
                }

                if (editingPhase) {
                    await updateGardenPhase(editingPhase.id, {
                        ...phaseForm,
                        lockedByCue: phaseForm.lockedByCue.trim(),
                    });
                    setMessage("Phase updated.");
                } else {
                    await createGardenPhase({
                        ...phaseForm,
                        lockedByCue: phaseForm.lockedByCue.trim(),
                    });
                    setMessage("Phase created.");
                }
                setEditingPhase(null);
                setPhaseForm({
                    title: "",
                    mode: "blocks",
                    description: "",
                    order: phases.length + 1,
                    lockedByCue: "",
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Failed to save phase";
                setMessage(msg);
            }
        });
    };

    const handlePhaseDelete = async (phaseId: string) => {
        const confirmDelete = window.confirm("Delete this phase and its levels?");
        if (!confirmDelete) return;
        setMessage(null);
        setBusyReset(true);
        try {
            await deleteGardenPhase(phaseId);
            setEditingPhase(null);
            setMessage("Phase deleted.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to delete phase";
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
                    setMessage("Level updated.");
                } else {
                    await createGardenLevel(payload);
                    setMessage("Level created.");
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
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Failed to save level";
                setMessage(msg);
            }
        });
    };

    const handleLevelDelete = async (levelId: string) => {
        const confirmDelete = window.confirm("Delete this level?");
        if (!confirmDelete) return;
        setMessage(null);
        setBusyReset(true);
        try {
            await deleteGardenLevel(levelId);
            setEditingLevel(null);
            setMessage("Level deleted.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to delete level";
            setMessage(msg);
        } finally {
            setBusyReset(false);
        }
    };

    const handleReset = async () => {
        const confirmReset = window.confirm("Replace all phases and levels with the default seed?");
        if (!confirmReset) return;
        setBusyReset(true);
        setMessage(null);
        try {
            await resetGardenToSeed();
            setMessage("Seed content loaded.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to reset content";
            setMessage(msg);
        } finally {
            setBusyReset(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 font-semibold shadow-shadow">
                    <LayoutDashboard className="mr-2 inline h-4 w-4" />
                    Section 1 · Admin
                </div>
                <div className="text-lg font-bold">Garden Builders Levels</div>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Phases</CardTitle>
                        <CardDescription>
                            Section 1 supports exactly three phases. Edit existing phases; new phases beyond three are ignored by the game.
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Sprout className="h-4 w-4" />
                        Data-driven
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                        Phases allowed: {phases.length}/{MAX_PHASES}. The game only reads three phases for Section 1.
                    </div>
                    <form className="grid gap-4 lg:grid-cols-5" onSubmit={handlePhaseSubmit}>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>Title</Label>
                            <Input
                                required
                                value={phaseForm.title}
                                onChange={(e) => setPhaseForm({ ...phaseForm, title: e.target.value })}
                                placeholder="Prompt Blocks"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select
                                value={phaseForm.mode}
                                onValueChange={(val) => setPhaseForm({ ...phaseForm, mode: val as GardenPhase["mode"] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="blocks">Blocks</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Order</Label>
                            <Input
                                type="number"
                                min={1}
                                value={phaseForm.order}
                                onChange={(e) => setPhaseForm({ ...phaseForm, order: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Locked by cue (optional)</Label>
                            <Input
                                value={phaseForm.lockedByCue}
                                onChange={(e) => setPhaseForm({ ...phaseForm, lockedByCue: e.target.value })}
                                placeholder="start-phase-3"
                            />
                        </div>
                        <div className="lg:col-span-3 space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                rows={2}
                                value={phaseForm.description}
                                onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                                placeholder="Explain the goal for this phase"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button
                                type="submit"
                                disabled={busyPhase || (!editingPhase && phases.length >= MAX_PHASES)}
                                className="w-full lg:w-auto"
                            >
                                {busyPhase ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving
                                    </>
                                ) : editingPhase ? (
                                    <>
                                        <Pencil className="h-4 w-4" />
                                        Update phase
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        Add phase
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
                                        No phases yet.
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
                        <CardTitle>Levels</CardTitle>
                        <CardDescription>Manage targets and optional prompt blocks per phase.</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={handleReset} disabled={busyReset}>
                            {busyReset ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Resetting
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-4 w-4" />
                                    Load default seed
                                </>
                            )}
                        </Button>
                        <Badge variant="outline">Real-time synced</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleLevelSubmit}>
                        <div className="space-y-2">
                            <Label>Phase</Label>
                            <Select
                                value={levelForm.phaseId}
                                onValueChange={(val) => setLevelForm({ ...levelForm, phaseId: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick phase" />
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
                            <Label>Order</Label>
                            <Input
                                type="number"
                                min={1}
                                value={levelForm.levelNumber}
                                onChange={(e) => setLevelForm({ ...levelForm, levelNumber: Number(e.target.value) })}
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>Target</Label>
                            <Input
                                required
                                value={levelForm.target}
                                onChange={(e) => setLevelForm({ ...levelForm, target: e.target.value })}
                                placeholder="Describe the desired image"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>Blocks (one per line or comma)</Label>
                            <Textarea
                                rows={3}
                                value={levelForm.blocks}
                                onChange={(e) => setLevelForm({ ...levelForm, blocks: e.target.value })}
                                placeholder="Generate\na cute rabbit"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>Bonus blocks (optional)</Label>
                            <Textarea
                                rows={3}
                                value={levelForm.bonusBlocks}
                                onChange={(e) => setLevelForm({ ...levelForm, bonusBlocks: e.target.value })}
                                placeholder="soft lighting\nwide angle"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-2">
                            <Label>Hint (optional)</Label>
                            <Textarea
                                rows={2}
                                value={levelForm.hint}
                                onChange={(e) => setLevelForm({ ...levelForm, hint: e.target.value })}
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button type="submit" disabled={busyLevel || !levelForm.phaseId} className="w-full lg:w-auto">
                                {busyLevel ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving
                                    </>
                                ) : editingLevel ? (
                                    <>
                                        <Pencil className="h-4 w-4" />
                                        Update level
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        Add level
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
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="space-y-4">
                        {groupedLevels.map(({ phase, levels: phaseLevels }) => (
                            <div key={phase.id} className="rounded-md border-4 border-foreground bg-secondary-background p-4 shadow-shadow">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="font-bold">
                                        {phase.title} <span className="text-sm font-semibold text-foreground/60">(order {phase.order})</span>
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
                                                <TableCell className="font-semibold">{lvl.levelNumber}</TableCell>
                                                <TableCell className="max-w-md">{lvl.target}</TableCell>
                                                <TableCell className="text-xs text-foreground/80">
                                                    {(lvl.blocks ?? []).join(", ") || "—"}
                                                </TableCell>
                                                <TableCell className="text-xs text-foreground/80">
                                                    {(lvl.bonusBlocks ?? []).join(", ") || "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => setEditingLevel(lvl)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleLevelDelete(lvl.id)}
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
                                                <TableCell colSpan={5} className="text-center font-semibold">
                                                    No levels for this phase yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                        {!groupedLevels.length && !loading && (
                            <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                                Add a phase to get started.
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
