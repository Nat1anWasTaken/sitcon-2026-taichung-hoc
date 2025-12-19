"use client";

import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Lock, Rabbit, Sparkles, Trash2, Trophy, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { GameCue, SectionProgress } from "@/lib/game-types";
import { SECTION_ONE_ID, SectionConfig } from "@/lib/game/config";

type ChildSession = {
    childId: string;
    seatNumber: number;
    name?: string | null;
};

const SECTION_ID = SECTION_ONE_ID;

type SectionOneProps = {
    onSectionComplete?: () => void;
};

export function SectionOneGame({ onSectionComplete }: SectionOneProps = {}) {
    const router = useRouter();
    const [session, setSession] = useState<ChildSession | null>(null);
    const [progress, setProgress] = useState<SectionProgress | null>(null);
    const [config, setConfig] = useState<SectionConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const [cues, setCues] = useState<GameCue[]>([]);
    const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
    const [typedPrompt, setTypedPrompt] = useState("");
    const lastServerPromptRef = useRef<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resultOverlay, setResultOverlay] = useState<{
        open: boolean;
        match: boolean | null;
        feedback: string | null;
        imageUrl: string | null;
    }>({ open: false, match: null, feedback: null, imageUrl: null });
    const completedNotifiedRef = useRef(false);
    const lastLevelRef = useRef<{ phase: number; level: number } | null>(null);

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
                const newProgress = progData.progress;

                // Detect if level or phase changed
                const levelChanged =
                    lastLevelRef.current &&
                    (lastLevelRef.current.phase !== newProgress?.currentPhase ||
                        lastLevelRef.current.level !== newProgress?.currentLevel);

                setProgress(newProgress);

                // Only restore image and prompt if level hasn't changed
                if (!levelChanged) {
                    const serverPrompt = newProgress?.lastPrompt ?? "";
                    // Only apply server prompt when it actually changed to avoid clobbering local edits
                    if (serverPrompt !== lastServerPromptRef.current) {
                        setTypedPrompt(serverPrompt);
                        lastServerPromptRef.current = serverPrompt;
                    }
                    setImageUrl(newProgress?.lastImageUrl ?? null);
                }
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
        const phaseIndex = Math.min(
            Math.max(progress.currentPhase - 1, 0),
            config.phases.length - 1
        );
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
    const isLockedByCue = lockedCueId ? !cues.some((c) => c.id === lockedCueId && c.active) : false;

    const isPhaseLocked = useMemo(() => {
        if (!progress) return false;
        if (progress.currentPhase === 3) {
            return (
                progress.phase1Complete === false ||
                progress.phase2Complete === false ||
                isLockedByCue
            );
        }
        if (progress.currentPhase === 2) {
            return progress.phase1Complete === false || isLockedByCue;
        }
        return isLockedByCue;
    }, [progress, isLockedByCue]);

    const lockReason = useMemo(() => {
        if (!isPhaseLocked || !progress) return null;

        if (progress.currentPhase === 3) {
            if (progress.phase1Complete === false || progress.phase2Complete === false) {
                return "請先完成前面的階段，教練會解鎖最終任務。";
            }
            return "你的教練尚未啟動最終任務。請保持此分頁開啟！";
        }

        if (progress.currentPhase === 2) {
            if (progress.phase1Complete === false) {
                return "請先完成第一階段以解鎖下一挑戰。";
            }
            return "你的教練尚未啟動第二階段。準備輸入你的提示吧！";
        }

        return "此階段已被教練鎖定。請等待指示！";
    }, [isPhaseLocked, progress]);

    const isSectionComplete = progress?.sectionComplete ?? false;

    useEffect(() => {
        if (isSectionComplete && !completedNotifiedRef.current) {
            completedNotifiedRef.current = true;
            onSectionComplete?.();
        }
    }, [isSectionComplete, onSectionComplete]);

    const shuffledBlocks = useMemo(() => {
        if (!mergedLevelConfig?.blocks) return [];

        const arr = [...mergedLevelConfig.blocks];
        for (let i = arr.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }, [mergedLevelConfig?.blocks]);

    // Only pre-fill blocks on very first load, not on level changes
    const initialLoadRef = useRef(true);
    useEffect(() => {
        if (initialLoadRef.current && phaseConfig?.mode === "blocks" && shuffledBlocks.length) {
            setSelectedBlocks(shuffledBlocks.slice(0, 2));
            initialLoadRef.current = false;
        }
    }, [phaseConfig?.mode, shuffledBlocks]);

    // Reset image and prompt when level or phase changes
    useEffect(() => {
        if (!progress) return;

        // Check if level or phase actually changed
        const currentLevel = { phase: progress.currentPhase, level: progress.currentLevel };
        const hasChanged =
            !lastLevelRef.current ||
            lastLevelRef.current.phase !== currentLevel.phase ||
            lastLevelRef.current.level !== currentLevel.level;

        if (hasChanged) {
            // Reset UI when moving to a new level/phase
            if (lastLevelRef.current) {
                // Only reset if this isn't the first load
                setImageUrl(null);
                setTypedPrompt("");
                setSelectedBlocks([]);
                lastServerPromptRef.current = null;
            }
            // Update the tracked level
            lastLevelRef.current = currentLevel;
        }
    }, [progress?.currentLevel, progress?.currentPhase]);

    const handleGenerate = async () => {
        if (!phaseConfig || !mergedLevelConfig) return;
        if (isSectionComplete) {
            setResultOverlay({
                open: true,
                match: false,
                feedback: "本單元已完成。請等候下一單元開始。",
                imageUrl,
            });
            return;
        }
        const prompt =
            phaseConfig.mode === "blocks" ? selectedBlocks.join(" ").trim() : typedPrompt.trim();

        if (!prompt) {
            setResultOverlay({
                open: true,
                match: false,
                feedback: "請先輸入一些文字！",
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
            if (!res.ok) throw new Error(data.error || "生成失敗");

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
            const message = err instanceof Error ? err.message : "發生錯誤";
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
                    載入你的遊戲…
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <SectionCompleteOverlay open={isSectionComplete} />
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                {!isSectionComplete && isPhaseLocked && lockReason && (
                    <PhaseLockedBanner message={lockReason} />
                )}
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 font-semibold shadow-shadow">
                            <Rabbit className="mr-2 inline h-4 w-4" />
                            Seat {session.seatNumber} · {session.childId}
                        </div>
                        {session.name && (
                            <div className="text-lg font-bold">嗨 {session.name}！</div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-4 w-4" />
                        {config?.title ?? "第一單元"}: {phaseConfig.title} · Level{" "}
                        {progress.currentLevel}
                    </div>
                </header>

                <Card>
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>{mergedLevelConfig.target}</CardTitle>
                            <CardDescription>
                                {phaseConfig.description ?? "建立一個提示以配對目標圖片。"}
                            </CardDescription>
                        </div>
                        <BadgeChip>
                            {isSectionComplete
                                ? "單元完成"
                                : `第 ${progress.currentPhase} 階段 / 共 ${config?.phases.length ?? 3} 階段`}
                        </BadgeChip>
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
                                    disabled={isPhaseLocked || isSectionComplete}
                                />
                            )}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading || isPhaseLocked || isSectionComplete}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            生成中…
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-4 w-4" />
                                            生成
                                        </>
                                    )}
                                </Button>
                                {isPhaseLocked && (
                                    <span className="text-sm font-semibold text-foreground/70">
                                        等待教練指示…
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm uppercase text-foreground/60">最新圖片</Label>
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
                                        生成後在此查看你的作品
                                    </div>
                                )}
                            </div>
                            <TargetProgress
                                progress={progress}
                                isPhaseLocked={isPhaseLocked}
                                sectionComplete={isSectionComplete}
                            />
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

function PhaseLockedBanner({ message }: { message: string }) {
    return (
        <Card className="border-4 border-foreground bg-secondary-background shadow-shadow">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <CardTitle className="text-base">階段已鎖定</CardTitle>
                </div>
                <BadgeChip>等待教練</BadgeChip>
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="font-semibold text-foreground">{message}</p>
                <p className="text-sm font-semibold text-foreground/70">
                    請保持此分頁開啟 — 一旦教練開始下一階段我們會立即解鎖。
                </p>
            </CardContent>
        </Card>
    );
}

function SectionCompleteOverlay({ open }: { open: boolean }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm">
            <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
                <div className="relative w-full rounded-2xl border-4 border-foreground bg-main p-7 shadow-shadow">
                    <div className="absolute -top-4 left-6 inline-flex items-center gap-2 rounded-full border-4 border-foreground bg-secondary-background px-4 py-1 text-xs font-semibold shadow-shadow">
                        <Trophy className="h-4 w-4" />
                        單元完成
                    </div>
                    <div className="space-y-4 text-center">
                        <p className="text-2xl font-black text-foreground">你已通過第一單元！</p>
                        <p className="text-base font-semibold text-foreground/80">
                            做得好。我們即將載入下一單元 — 請保持此分頁開啟，並注意教練指示。
                        </p>
                        <p className="text-sm font-semibold text-foreground/60">
                            提示：你仍可查看下方最後的圖片，但生成功能已暫停。
                        </p>
                    </div>
                </div>
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
    const [ghostIndex, setGhostIndex] = useState<number | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id.toString());
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) {
            setGhostIndex(null);
            return;
        }

        const activeId = active.id.toString();
        // Only show ghost when dragging a NEW source block
        if (!activeId.startsWith("source-")) {
            setGhostIndex(null);
            return;
        }

        const overId = over.id.toString();

        if (overId === "prompt-bar") {
            // Append if over the container background
            setGhostIndex(selected.length);
            return;
        }

        if (overId === "ghost-placeholder") {
            // Keep current index if over the ghost itself
            return;
        }

        // If over an existing item, find its index
        const index = selectedWithIds.findIndex((item) => item.id === overId);
        if (index !== -1) {
            setGhostIndex(index);
        } else if (overId === "removal-zone") {
            setGhostIndex(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);

        // Capture ghost index before resetting
        const finalGhostIndex = ghostIndex;
        setGhostIndex(null);

        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();
        const activeBlockLabel = active.data?.current?.block as string | undefined;
        const activeIsSource = activeId.startsWith("source-");
        const activeIsSelected = activeId.startsWith("selected-");
        const overIsRemoval = overId === "removal-zone";
        const overSortable = over.data?.current?.sortable;
        const overIsSelected = overId.startsWith("selected-") || Boolean(overSortable);

        // 1) Remove when dropped on the bin
        if (overIsRemoval && activeIsSelected) {
            const index = selectedWithIds.findIndex((item) => item.id === activeId);
            if (index !== -1) removeAt(index);
            return;
        }

        // 2) Add a source block
        if (activeIsSource) {
            if (!activeBlockLabel) return;
            if (overIsRemoval) return; // Do nothing if dropped on trash

            let insertAt = selected.length;
            if (finalGhostIndex !== null) {
                insertAt = finalGhostIndex;
            } else if (overIsSelected) {
                // Fallback (unlikely if dragOver worked)
                insertAt = overSortable?.index ?? selectedWithIds.findIndex((i) => i.id === overId);
                if (insertAt === -1) insertAt = selected.length;
            }

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

    const handleDragCancel = () => {
        setActiveDragId(null);
        setGhostIndex(null);
    };

    const activeBlock = useMemo(() => {
        if (!activeDragId) return null;
        // Prefer the data set on the draggable/sortable (handles duplicate labels)
        const dragData = activeDragId.startsWith("source-")
            ? sourceBlocks.find((s) => s.id === activeDragId)?.block
            : selectedWithIds.find((item) => item.id === activeDragId)?.block;
        return dragData ?? null;
    }, [activeDragId, selectedWithIds, sourceBlocks]);

    // Construct the list of items to display in the prompt bar (including ghost)
    const itemsWithGhost = useMemo(() => {
        // Only inject ghost if dragging source and we have a position
        if (ghostIndex === null || !activeDragId?.startsWith("source-")) {
            return selectedWithIds;
        }

        const draggingBlock = sourceBlocks.find((b) => b.id === activeDragId)?.block;
        if (!draggingBlock) return selectedWithIds;

        const newItems = [...selectedWithIds];
        const safeIndex = Math.max(0, Math.min(ghostIndex, newItems.length));

        // Insert a ghost item
        newItems.splice(safeIndex, 0, {
            id: "ghost-placeholder",
            block: draggingBlock,
        });

        return newItems;
    }, [selectedWithIds, ghostIndex, activeDragId, sourceBlocks]);

    const removeAt = (idx: number) => {
        const copy = [...selected];
        copy.splice(idx, 1);
        onSelect(copy);
    };

    return (
        <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="space-y-3">
                <Label className="text-sm uppercase text-foreground/70">提示區塊</Label>
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
                    items={itemsWithGhost}
                    onRemove={removeAt}
                    isEmpty={selected.length === 0 && !ghostIndex}
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
    items,
    onRemove,
    isEmpty,
}: {
    items: { id: string; block: string }[];
    onRemove: (idx: number) => void;
    isEmpty: boolean;
}) {
    const { setNodeRef } = useDroppable({ id: "prompt-bar" });

    return (
        <div
            ref={setNodeRef}
            className="min-h-[96px] rounded-md border-4 border-dashed border-foreground bg-secondary-background p-3 shadow-shadow transition-transform duration-150 ease-out hover:-translate-y-0.5"
        >
            <p className="text-xs uppercase text-foreground/60">提示欄</p>
            {isEmpty && (
                <p className="mt-2 text-sm font-semibold text-foreground/70">
                    將區塊拖到這裡，或點擊以新增。
                </p>
            )}
            <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
                <div className="mt-2 flex flex-wrap gap-2">
                    {items.map((item, idx) => {
                        // Check if it's the ghost placeholder
                        const isGhost = item.id === "ghost-placeholder";
                        return (
                            <SortableBlock
                                key={item.id}
                                id={item.id}
                                block={item.block}
                                onRemove={() => onRemove(idx)}
                                isGhost={isGhost}
                            />
                        );
                    })}
                </div>
            </SortableContext>
        </div>
    );
}

function SortableBlock({
    id,
    block,
    onRemove,
    isGhost,
}: {
    id: string;
    block: string;
    onRemove: () => void;
    isGhost?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        data: { block },
        disabled: isGhost, // Disable sorting interactions for the ghost itself
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        // Disable transition while dragging to stop the "slow chase" lag behind the pointer
        transition: isDragging
            ? "none"
            : (transition ?? "transform 150ms ease-out, box-shadow 150ms ease-out"),
        // We show the ghost visually via classes, so we don't need to hide it entirely
        // unless it's the actual ghost-placeholder which has its own opacity
        opacity: isGhost ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : isGhost ? "default" : "grab",
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            onClick={isGhost ? undefined : onRemove}
            {...listeners}
            {...attributes}
            className={`rounded-md border-4 border-foreground px-3 py-2 text-sm font-semibold touch-none transition-all duration-150 ${
                isGhost || isDragging
                    ? "border-dashed bg-transparent shadow-none opacity-50"
                    : "bg-main shadow-shadow hover:-translate-y-0.5 hover:rotate-1 hover:shadow-lg"
            }`}
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
                    {isOver ? "放開以移除" : "拖到這裡以移除"}
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
                    {success ? "配對成功" : "再試一次"}
                </div>
                <div className="grid gap-4 sm:grid-cols-[2fr,1fr] sm:items-center">
                    <div className="space-y-3">
                        <div className="text-2xl font-bold">
                            {success ? "做得好！已解鎖下一關。" : "還不完全正確—請調整你的提示。"}
                        </div>
                        <p className="text-base font-semibold text-foreground/80">
                            {feedback ?? (success ? "看起來不錯！" : "再試一次。")}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" onClick={onClose} className="shadow-shadow">
                                繼續
                            </Button>
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                        {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={imageUrl}
                                alt="Latest generated"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full min-h-[180px] items-center justify-center text-sm font-semibold text-foreground/60">
                                無預覽
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
    isPhaseLocked,
    sectionComplete,
}: {
    progress: SectionProgress;
    isPhaseLocked: boolean;
    sectionComplete: boolean;
}) {
    const phaseBadges = [
        { label: "Phase 1", done: !!progress.phase1Complete },
        { label: "Phase 2", done: !!progress.phase2Complete },
        {
            label: "Phase 3",
            done: !!progress.phase3Complete || sectionComplete,
            locked: isPhaseLocked && progress.currentPhase === 3,
        },
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
