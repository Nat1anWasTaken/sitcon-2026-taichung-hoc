"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Rabbit, Sparkles, Wand2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    useDraggable,
    useDroppable,
    closestCenter,
    DragOverlay,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    arrayMove,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SECTION_ONE_ID, SectionConfig } from "@/lib/game/config";
import { GameCue, SectionProgress } from "@/lib/game-types";

type ChildSession = {
    childId: string;
    seatNumber: number;
    name?: string | null;
};

const SECTION_ID = SECTION_ONE_ID;

export function SectionOneGame() {
    const router = useRouter();
    const [session, setSession] = useState<ChildSession | null>(null);
    const [progress, setProgress] = useState<SectionProgress | null>(null);
    const [config, setConfig] = useState<SectionConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const [cues, setCues] = useState<GameCue[]>([]);
    const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
    const [typedPrompt, setTypedPrompt] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resultOverlay, setResultOverlay] = useState<{
        open: boolean;
        match: boolean | null;
        feedback: string | null;
        imageUrl: string | null;
    }>({ open: false, match: null, feedback: null, imageUrl: null });

    useEffect(() => {
        let active = true;
        const loadConfig = async () => {
            setConfigLoading(true);
            try {
                const res = await fetch("/api/game/section-one/config", { credentials: "include" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load config");
                if (!active) return;
                setConfig(data.config as SectionConfig);
                setConfigError(null);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to load config";
                if (!active) return;
                setConfigError(message);
            } finally {
                if (active) setConfigLoading(false);
            }
        };
        loadConfig();
        return () => {
            active = false;
        };
    }, []);

    const refreshState = useCallback(async () => {
        try {
            const [progRes, cuesRes] = await Promise.all([
                fetch(`/api/game/progress/${SECTION_ID}`, { credentials: "include" }),
                fetch("/api/game/cues", { credentials: "include" }),
            ]);

            if (progRes.ok) {
                const progData = await progRes.json();
                setProgress(progData.progress);
                setTypedPrompt(progData.progress?.lastPrompt ?? "");
                setImageUrl(progData.progress?.lastImageUrl ?? null);
            }

            if (cuesRes.ok) {
                const cuesData = await cuesRes.json();
                setCues(cuesData.cues);
            }
        } catch (err) {
            console.error("Failed to refresh game state", err);
        }
    }, []);

    useEffect(() => {
        let active = true;
        const loadState = async () => {
            const meRes = await fetch("/api/child/me", { credentials: "include" });
            if (!meRes.ok) {
                router.replace("/");
                return;
            }
            const { session: me } = await meRes.json();
            if (!active) return;
            setSession(me);

            await refreshState();
        };
        loadState();

        const id = setInterval(() => {
            refreshState();
        }, 2500);

        return () => {
            active = false;
            clearInterval(id);
        };
    }, [router, refreshState]);

    const phaseConfig = useMemo(() => {
        if (!progress || !config?.phases.length) return null;
        const phaseIndex = Math.min(Math.max(progress.currentPhase - 1, 0), config.phases.length - 1);
        return config.phases[phaseIndex];
    }, [config?.phases, progress]);

    const levelConfig = useMemo(() => {
        if (!progress || !phaseConfig) return null;
        const { levels } = phaseConfig;
        if (!levels.length) return null;
        const levelIndex = Math.min(Math.max(progress.currentLevel - 1, 0), levels.length - 1);
        return levels[levelIndex];
    }, [phaseConfig, progress]);

    const bonusBlocksActive = cues.some((c) => c.id === "unlock-bonus-blocks" && c.active);

    const mergedLevelConfig = useMemo(() => {
        if (!levelConfig) return null;
        if (phaseConfig?.mode === "blocks" && bonusBlocksActive && levelConfig.blocks) {
            return {
                ...levelConfig,
                blocks: [...levelConfig.blocks, ...(levelConfig.bonusBlocks ?? [])],
            };
        }
        return levelConfig;
    }, [bonusBlocksActive, levelConfig, phaseConfig?.mode]);

    const lockedCueId = phaseConfig?.lockedByCue;
    const lockedByCue = lockedCueId ? !cues.some((c) => c.id === lockedCueId && c.active) : false;
    const phase3Locked =
        progress?.currentPhase === 3
            ? progress?.phase1Complete === false || progress?.phase2Complete === false || lockedByCue
            : lockedByCue;
    const isPhaseLocked = progress?.currentPhase === 3 ? phase3Locked : lockedByCue;

    const shuffledBlocks = useMemo(() => {
        if (!mergedLevelConfig?.blocks) return [];

        const arr = [...mergedLevelConfig.blocks];
        for (let i = arr.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }, [mergedLevelConfig?.blocks]);

    useEffect(() => {
        if (phaseConfig?.mode === "blocks" && shuffledBlocks.length) {
            setSelectedBlocks(shuffledBlocks.slice(0, 2));
        }
    }, [phaseConfig?.mode, mergedLevelConfig?.id, shuffledBlocks]);

    const handleGenerate = async () => {
        if (!phaseConfig || !mergedLevelConfig) return;
        const prompt =
            phaseConfig.mode === "blocks" ? selectedBlocks.join(" ").trim() : typedPrompt.trim();

        if (!prompt) {
            setResultOverlay({
                open: true,
                match: false,
                feedback: "Add some words first!",
                imageUrl,
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/game/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, sectionId: SECTION_ID }),
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Generation failed");

            setImageUrl(data.imageUrl);
            setProgress(data.progress);
            setResultOverlay({
                open: true,
                match: data.evaluation.match,
                feedback: data.evaluation.feedback,
                imageUrl: data.imageUrl,
            });
            if (phaseConfig.mode === "blocks") {
                setSelectedBlocks([]);
            } else {
                setTypedPrompt(prompt);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            setResultOverlay({
                open: true,
                match: false,
                feedback: message,
                imageUrl,
            });
        } finally {
            setLoading(false);
        }
    };

    if (configError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-6 py-4 font-semibold shadow-shadow">
                    {configError}
                </div>
            </div>
        );
    }

    if (!session || !progress || !phaseConfig || !mergedLevelConfig || configLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-6 py-4 font-semibold shadow-shadow">
                    Loading your game…
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background px-4 py-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 font-semibold shadow-shadow">
                            <Rabbit className="mr-2 inline h-4 w-4" />
                            Seat {session.seatNumber} · {session.childId}
                        </div>
                        {session.name && (
                            <div className="text-lg font-bold">Hi {session.name}!</div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-4 w-4" />
                        {config?.title ?? "Garden Builders"}: {phaseConfig.title} · Level {progress.currentLevel}
                    </div>
                </header>

                <Card>
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>{mergedLevelConfig.target}</CardTitle>
                            <CardDescription>
                                {phaseConfig.description ?? "Build a prompt to match the target image."}
                            </CardDescription>
                        </div>
                        <BadgeChip>Phase {progress.currentPhase} of {config?.phases.length ?? 3}</BadgeChip>
                    </CardHeader>
                    <CardContent className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            {phaseConfig.mode === "blocks" ? (
                                <BlockBuilder
                                    blocks={shuffledBlocks}
                                    selected={selectedBlocks}
                                    onSelect={setSelectedBlocks}
                                />
                            ) : (
                                <TextPromptInput
                                    value={typedPrompt}
                                    onChange={setTypedPrompt}
                                    disabled={isPhaseLocked}
                                />
                            )}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button onClick={handleGenerate} disabled={loading || isPhaseLocked}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Generating…
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-4 w-4" />
                                            Generate
                                        </>
                                    )}
                                </Button>
                                {phase3Locked && progress.currentPhase === 3 && (
                                    <span className="text-sm font-semibold text-foreground/70">
                                        Waiting for admin cue + everyone to finish.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm uppercase text-foreground/60">Latest image</Label>
                            <div className="aspect-square w-full overflow-hidden rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                                {imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={imageUrl}
                                        alt="Generated preview"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm font-semibold text-foreground/60">
                                        Generate to see your art here
                                    </div>
                                )}
                            </div>
                            <TargetProgress progress={progress} phase3Locked={phase3Locked} />
                        </div>
                    </CardContent>
                </Card>
                <ResultOverlay
                    open={resultOverlay.open}
                    match={resultOverlay.match}
                    feedback={resultOverlay.feedback}
                    imageUrl={resultOverlay.imageUrl ?? imageUrl}
                    onClose={() => setResultOverlay((prev) => ({ ...prev, open: false }))}
                />
            </div>
        </div>
    );
}

function BadgeChip({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full border-4 border-foreground bg-secondary-background px-3 py-1 text-xs font-semibold shadow-shadow">
            {children}
        </span>
    );
}

function BlockBuilder({
    blocks,
    selected,
    onSelect,
}: {
    blocks: string[];
    selected: string[];
    onSelect: (blocks: string[]) => void;
}) {
    // Stable unique IDs for each source block even when labels repeat
    const sourceBlocks = useMemo(
        () => blocks.map((block, idx) => ({ id: `source-${idx}`, block })),
        [blocks]
    );

    // Create unique IDs for selected blocks
    const selectedWithIds = useMemo(
        () => selected.map((block, idx) => ({ id: `selected-${idx}`, block })),
        [selected]
    );

    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id.toString());
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();
        const activeBlockLabel = active.data?.current?.block as string | undefined;
        const activeIsSource = activeId.startsWith("source-");
        const activeIsSelected = activeId.startsWith("selected-");
        const overIsRemoval = overId === "removal-zone";
        const overIsPrompt = overId === "prompt-bar";
        const overSortable = over.data?.current?.sortable;
        const overIsSelected = overId.startsWith("selected-") || Boolean(overSortable);

        // 1) Remove when dropped on the bin
        if (overIsRemoval && activeIsSelected) {
            const index = selectedWithIds.findIndex((item) => item.id === activeId);
            if (index !== -1) removeAt(index);
            return;
        }

        // 2) Add a source block anywhere on the prompt bar (empty space OR on a chip)
        if (activeIsSource) {
            if (!activeBlockLabel) return;
            const insertAt =
                overIsPrompt || !overIsSelected
                    ? selected.length
                    : (overSortable?.index ?? selectedWithIds.findIndex((i) => i.id === overId));

            const next = [...selected];
            next.splice(insertAt, 0, activeBlockLabel);
            onSelect(next);
            return;
        }

        // 3) Reorder selected chips
        if (activeIsSelected && overIsSelected) {
            const oldIndex = selectedWithIds.findIndex((item) => item.id === activeId);
            const newIndex =
                overSortable?.index ?? selectedWithIds.findIndex((item) => item.id === overId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                onSelect(arrayMove(selected, oldIndex, newIndex));
            }
        }
    };

    const handleDragCancel = () => setActiveDragId(null);

    const activeBlock = useMemo(() => {
        if (!activeDragId) return null;
        // Prefer the data set on the draggable/sortable (handles duplicate labels)
        const dragData = activeDragId.startsWith("source-")
            ? sourceBlocks.find((s) => s.id === activeDragId)?.block
            : selectedWithIds.find((item) => item.id === activeDragId)?.block;
        return dragData ?? null;
    }, [activeDragId, selectedWithIds, sourceBlocks]);

    const removeAt = (idx: number) => {
        const copy = [...selected];
        copy.splice(idx, 1);
        onSelect(copy);
    };

    return (
        <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="space-y-3">
                <Label className="text-sm uppercase text-foreground/70">Prompt blocks</Label>
                <div className="flex flex-wrap gap-2">
                    {sourceBlocks.map(({ id, block }) => (
                        <DraggableBlock
                            key={id}
                            id={id}
                            block={block}
                            onClick={() => onSelect([...selected, block])}
                        />
                    ))}
                </div>
                <PromptBar
                    selectedWithIds={selectedWithIds}
                    onRemove={removeAt}
                    isEmpty={selected.length === 0}
                />
                <RemovalZone />
            </div>
            <DragOverlay dropAnimation={null}>
                {activeBlock ? <OverlayBlock label={activeBlock} /> : null}
            </DragOverlay>
        </DndContext>
    );
}

function DraggableBlock({
    id,
    block,
    onClick,
}: {
    id: string;
    block: string;
    onClick: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        data: { block },
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0 : 1, // hide original while overlay follows pointer
        cursor: isDragging ? "grabbing" : "grab",
        transition: isDragging ? "none" : "transform 150ms ease-out, box-shadow 150ms ease-out",
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            {...listeners}
            {...attributes}
            className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow hover:-translate-y-0.5 hover:rotate-1 hover:shadow-lg touch-none"
        >
            {block}
        </button>
    );
}

function PromptBar({
    selectedWithIds,
    onRemove,
    isEmpty,
}: {
    selectedWithIds: { id: string; block: string }[];
    onRemove: (idx: number) => void;
    isEmpty: boolean;
}) {
    const { setNodeRef } = useDroppable({ id: "prompt-bar" });

    return (
        <div
            ref={setNodeRef}
            className="min-h-[96px] rounded-md border-4 border-dashed border-foreground bg-secondary-background p-3 shadow-shadow transition-transform duration-150 ease-out hover:-translate-y-0.5"
        >
            <p className="text-xs uppercase text-foreground/60">Prompt bar</p>
            {isEmpty && (
                <p className="mt-2 text-sm font-semibold text-foreground/70">
                    Drag blocks here, or click them to add.
                </p>
            )}
            <SortableContext
                items={selectedWithIds.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="mt-2 flex flex-wrap gap-2">
                    {selectedWithIds.map((item, idx) => (
                        <SortableBlock
                            key={item.id}
                            id={item.id}
                            block={item.block}
                            onRemove={() => onRemove(idx)}
                        />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
}

function SortableBlock({
    id,
    block,
    onRemove,
}: {
    id: string;
    block: string;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        data: { block },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        // Disable transition while dragging to stop the "slow chase" lag behind the pointer
        transition: isDragging
            ? "none"
            : (transition ?? "transform 150ms ease-out, box-shadow 150ms ease-out"),
        opacity: isDragging ? 0 : 1, // hide original while overlay follows pointer
        cursor: isDragging ? "grabbing" : "grab",
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            onClick={onRemove}
            {...listeners}
            {...attributes}
            className="rounded-md border-4 border-foreground bg-main px-2 py-1 text-xs font-semibold shadow-shadow hover:-translate-y-0.5 hover:rotate-1 hover:shadow-lg touch-none"
        >
            {block}
        </button>
    );
}

function OverlayBlock({ label }: { label: string }) {
    return (
        <div className="rounded-md border-4 border-foreground bg-main px-3 py-2 text-sm font-semibold shadow-shadow pointer-events-none transition-transform duration-150 ease-out">
            {label}
        </div>
    );
}

function RemovalZone() {
    const { setNodeRef, isOver } = useDroppable({ id: "removal-zone" });

    return (
        <div
            ref={setNodeRef}
            className={`flex min-h-[96px] items-center justify-center rounded-md border-4 border-dashed px-4 py-3 shadow-shadow transition-colors transition-transform duration-150 ease-out ${
                isOver
                    ? "border-red-600 bg-red-100 scale-[1.02]"
                    : "border-foreground/40 bg-secondary-background"
            }`}
        >
            <div className="flex flex-col items-center gap-2">
                <Trash2 className={`h-6 w-6 ${isOver ? "text-red-600" : "text-foreground/60"}`} />
                <p
                    className={`text-xs font-semibold uppercase ${isOver ? "text-red-600" : "text-foreground/60"}`}
                >
                    {isOver ? "Drop to remove" : "Drag here to remove"}
                </p>
            </div>
        </div>
    );
}

function ResultOverlay({
    open,
    match,
    feedback,
    imageUrl,
    onClose,
}: {
    open: boolean;
    match: boolean | null;
    feedback: string | null;
    imageUrl: string | null;
    onClose: () => void;
}) {
    if (!open) return null;
    const success = match === true;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div
                className={`relative w-[95vw] max-w-3xl rounded-2xl border-4 border-foreground p-6 shadow-shadow transition-transform duration-300 ${
                    success ? "bg-green-100" : "bg-red-100"
                }`}
            >
                <div className="absolute -top-4 left-6 inline-flex items-center gap-2 rounded-full border-4 border-foreground bg-main px-4 py-1 text-xs font-semibold shadow-shadow">
                    {success ? "Match found" : "Try again"}
                </div>
                <div className="grid gap-4 sm:grid-cols-[2fr,1fr] sm:items-center">
                    <div className="space-y-3">
                        <div className="text-2xl font-bold">
                            {success ? "Great job! Next level unlocked." : "Not quite—tweak your prompt."}
                        </div>
                        <p className="text-base font-semibold text-foreground/80">
                            {feedback ?? (success ? "Looks good!" : "Give it another go.")}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" onClick={onClose} className="shadow-shadow">
                                Continue
                            </Button>
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                        {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt="Latest generated" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full min-h-[180px] items-center justify-center text-sm font-semibold text-foreground/60">
                                No preview
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TextPromptInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm uppercase text-foreground/70">Type your prompt</Label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full rounded-md border-4 border-foreground bg-secondary-background px-3 py-3 text-base font-semibold shadow-shadow outline-none focus:-translate-y-0.5 focus:border-foreground"
                rows={4}
                placeholder="Describe the image you want..."
            />
        </div>
    );
}

function TargetProgress({
    progress,
    phase3Locked,
}: {
    progress: SectionProgress;
    phase3Locked: boolean;
}) {
    const phaseBadges = [
        { label: "Phase 1", done: !!progress.phase1Complete },
        { label: "Phase 2", done: !!progress.phase2Complete },
        { label: "Phase 3", done: !!progress.phase3Complete, locked: phase3Locked },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {phaseBadges.map((p, idx) => (
                <span
                    key={p.label}
                    className={`rounded-md border-4 px-3 py-2 text-xs font-semibold shadow-shadow ${
                        p.done
                            ? "border-green-600 bg-green-100 text-green-800"
                            : p.locked
                              ? "border-foreground bg-secondary-background text-foreground/60"
                              : "border-foreground bg-secondary-background"
                    }`}
                >
                    {p.label} {p.done ? "✓" : p.locked ? "(locked)" : ""}
                    {idx + 1 === progress.currentPhase && !p.done ? " · now" : ""}
                </span>
            ))}
        </div>
    );
}
