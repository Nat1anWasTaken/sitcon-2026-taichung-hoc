"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Rabbit, Sparkles, Wand2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { sectionOne } from "@/lib/game/config";
import { GameCue, SectionProgress } from "@/lib/game-types";

type ChildSession = {
  childId: string;
  seatNumber: number;
  name?: string | null;
};

const SECTION_ID = sectionOne.id;

export function SectionOneGame() {
  const router = useRouter();
  const [session, setSession] = useState<ChildSession | null>(null);
  const [progress, setProgress] = useState<SectionProgress | null>(null);
  const [cues, setCues] = useState<GameCue[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [typedPrompt, setTypedPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [match, setMatch] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const meRes = await fetch("/api/child/me", { credentials: "include" });
      if (!meRes.ok) {
        router.replace("/");
        return;
      }
      const { session: me } = await meRes.json();
      setSession(me);

      const progRes = await fetch(`/api/game/progress/${SECTION_ID}`, {
        credentials: "include",
      });
      const progData = await progRes.json();
      setProgress(progData.progress);
      setTypedPrompt(progData.progress?.lastPrompt ?? "");

      const cuesRes = await fetch("/api/game/cues", { credentials: "include" });
      const cuesData = await cuesRes.json();
      setCues(cuesData.cues);
      setImageUrl(progData.progress?.lastImageUrl ?? null);
      setMatch(progData.progress?.lastMatch ?? null);
      setFeedback(progData.progress?.lastFeedback ?? null);
    };
    bootstrap();
  }, [router]);

  useEffect(() => {
    const id = setInterval(async () => {
      const cuesRes = await fetch("/api/game/cues", { credentials: "include" });
      if (cuesRes.ok) {
        const cuesData = await cuesRes.json();
        setCues(cuesData.cues);
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const phaseConfig = useMemo(() => {
    if (!progress) return null;
    return sectionOne.phases[progress.currentPhase - 1];
  }, [progress]);

  const levelConfig = useMemo(() => {
    if (!progress || !phaseConfig) return null;
    const baseLevel = phaseConfig.levels[progress.currentLevel - 1];
    if (!baseLevel) return null;

    const bonusBlocksActive = cues.some(
      (c) => c.id === "unlock-bonus-blocks" && c.active,
    );
    if (
      phaseConfig.mode === "blocks" &&
      bonusBlocksActive &&
      baseLevel.blocks
    ) {
      return {
        ...baseLevel,
        blocks: [...baseLevel.blocks, ...(baseLevel.bonusBlocks ?? [])],
      };
    }

    return baseLevel;
  }, [cues, phaseConfig, progress]);

  const startPhase3Active = cues.some(
    (c) => c.id === "start-phase-3" && c.active,
  );
  const phase3Locked =
    progress?.phase1Complete === false ||
    progress?.phase2Complete === false ||
    !startPhase3Active;

  const shuffledBlocks = useMemo(() => {
    if (!levelConfig?.blocks) return [];

    // Fisher–Yates shuffle to randomize block order each load while keeping it stable for the session.
    const arr = [...levelConfig.blocks];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [levelConfig?.blocks, levelConfig?.id]);

  useEffect(() => {
    if (phaseConfig?.mode === "blocks" && shuffledBlocks.length) {
      setSelectedBlocks(shuffledBlocks.slice(0, 2));
    }
  }, [phaseConfig?.mode, levelConfig?.id, shuffledBlocks]);

  const handleGenerate = async () => {
    if (!phaseConfig || !levelConfig) return;
    const prompt =
      phaseConfig.mode === "blocks"
        ? selectedBlocks.join(" ").trim()
        : typedPrompt.trim();

    if (!prompt) {
      setFeedback("Add some words first!");
      setMatch(null);
      return;
    }

    setLoading(true);
    setFeedback(null);
    setMatch(null);
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
      setFeedback(data.evaluation.feedback);
      setMatch(data.evaluation.match);
      setProgress(data.progress);
      if (phaseConfig.mode === "blocks") {
        setSelectedBlocks([]);
      } else {
        setTypedPrompt(prompt);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setFeedback(message);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  };

  if (!session || !progress || !phaseConfig || !levelConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-md border-4 border-foreground bg-secondary-background px-6 py-4 font-semibold shadow-shadow">
          Loading your game…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="grid flex-1 grid-rows-[auto,1fr] gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-3 rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 shadow-shadow sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md border-4 border-foreground bg-background px-3 py-2 font-semibold shadow-shadow">
              <Rabbit className="mr-2 inline h-4 w-4" />
              Seat {session.seatNumber} · {session.childId}
            </div>
            {session.name && (
              <div className="text-lg font-bold">Hi {session.name}!</div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" />
            {phaseConfig.title} · Level {progress.currentLevel}
          </div>
        </header>

        <Card className="h-full">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{levelConfig.target}</CardTitle>
              <CardDescription>
                {phaseConfig.description ??
                  "Build a prompt to match the target image."}
              </CardDescription>
            </div>
            <BadgeChip>Phase {progress.currentPhase} of 3</BadgeChip>
          </CardHeader>
          <CardContent className="grid h-full gap-6 lg:grid-cols-[1.15fr_1fr] xl:grid-cols-[1.25fr_1fr]">
            <div className="flex flex-col gap-4">
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
                  disabled={progress.currentPhase === 3 && phase3Locked}
                />
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={
                    loading || (progress.currentPhase === 3 && phase3Locked)
                  }
                >
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
                {match === true && (
                  <span className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow">
                    Nice! Next level is ready.
                  </span>
                )}
                {phase3Locked && progress.currentPhase === 3 && (
                  <span className="text-sm font-semibold text-foreground/70">
                    Waiting for admin cue + everyone to finish.
                  </span>
                )}
              </div>
              {feedback && (
                <div
                  className={`rounded-md border-4 px-3 py-2 text-sm font-semibold shadow-shadow ${
                    match
                      ? "border-green-600 text-green-700"
                      : "border-foreground"
                  }`}
                >
                  {feedback}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Label className="text-sm uppercase text-foreground/60">
                Latest image
              </Label>
              <div className="flex flex-1 min-h-[320px] overflow-hidden rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Generated preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground/60">
                    Generate to see your art here
                  </div>
                )}
              </div>
              <TargetProgress progress={progress} phase3Locked={phase3Locked} />
            </div>
          </CardContent>
        </Card>
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
  const [activeId, setActiveId] = useState<string | null>(null);

  // Create unique IDs for selected blocks
  const selectedWithIds = useMemo(
    () => selected.map((block, idx) => ({ id: `selected-${idx}`, block })),
    [selected],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Check if dropping on removal zone
    if (over.id === "removal-zone") {
      // Only remove if dragging from selected blocks
      if (active.id.toString().startsWith("selected-")) {
        const index = selectedWithIds.findIndex(
          (item) => item.id === active.id,
        );
        if (index !== -1) {
          removeAt(index);
        }
      }
      return;
    }

    // Check if dragging from source blocks to prompt bar
    if (active.id.toString().startsWith("source-")) {
      const block = active.id.toString().replace("source-", "");
      // Add to selected if dropping on the prompt bar area
      if (over.id === "prompt-bar") {
        onSelect([...selected, block]);
      }
      return;
    }

    // Handle reordering within selected blocks
    if (
      active.id.toString().startsWith("selected-") &&
      over.id.toString().startsWith("selected-")
    ) {
      const oldIndex = selectedWithIds.findIndex(
        (item) => item.id === active.id,
      );
      const newIndex = selectedWithIds.findIndex((item) => item.id === over.id);

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(selected, oldIndex, newIndex);
        onSelect(reordered);
      }
    }
  };

  const removeAt = (idx: number) => {
    const copy = [...selected];
    copy.splice(idx, 1);
    onSelect(copy);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(event.active.id.toString())}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        <Label className="text-sm uppercase text-foreground/70">
          Prompt blocks
        </Label>
        <div className="flex flex-wrap gap-2">
          {blocks.map((block, idx) => (
            <DraggableBlock
              key={`${block}-${idx}`}
              id={`source-${block}`}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...listeners}
      {...attributes}
      className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow transition hover:-translate-y-0.5 touch-none"
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
      className="min-h-[96px] rounded-md border-4 border-dashed border-foreground bg-secondary-background p-3 shadow-shadow"
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
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onRemove}
      {...listeners}
      {...attributes}
      className="rounded-md border-4 border-foreground bg-main px-2 py-1 text-xs font-semibold shadow-shadow transition hover:-translate-y-0.5 touch-none cursor-move"
    >
      {block}
    </button>
  );
}

function RemovalZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "removal-zone" });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[96px] items-center justify-center rounded-md border-4 border-dashed px-4 py-3 shadow-shadow transition-colors ${
        isOver
          ? "border-red-600 bg-red-100"
          : "border-foreground/40 bg-secondary-background"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <Trash2
          className={`h-6 w-6 ${isOver ? "text-red-600" : "text-foreground/60"}`}
        />
        <p
          className={`text-xs font-semibold uppercase ${isOver ? "text-red-600" : "text-foreground/60"}`}
        >
          {isOver ? "Drop to remove" : "Drag here to remove"}
        </p>
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
      <Label className="text-sm uppercase text-foreground/70">
        Type your prompt
      </Label>
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
