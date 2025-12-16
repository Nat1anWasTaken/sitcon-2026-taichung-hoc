'use client';

import { useEffect, useMemo, useState } from "react";
import { Loader2, Rabbit, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { sectionOne } from "@/lib/game/config";
import { GameCue, SectionProgress } from "@/lib/game-types";

type ChildSession = {
  childId: string;
  seatNumber: number;
  name?: string | null;
};

export default function GamePage() {
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

      const progRes = await fetch("/api/game/progress/section-1", { credentials: "include" });
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
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const phaseConfig = useMemo(() => {
    if (!progress) return null;
    return sectionOne.phases[progress.currentPhase - 1];
  }, [progress]);

  const levelConfig = useMemo(() => {
    if (!progress || !phaseConfig) return null;
    return phaseConfig.levels[progress.currentLevel - 1];
  }, [progress, phaseConfig]);

  const startPhase3Active = cues.some((c) => c.id === "start-phase-3" && c.active);
  const phase3Locked =
    (progress?.phase1Complete === false || progress?.phase2Complete === false) ||
    !startPhase3Active;

  useEffect(() => {
    if (phaseConfig?.mode === "blocks" && levelConfig?.blocks?.length) {
      setSelectedBlocks(levelConfig.blocks.slice(0, 2));
    }
  }, [phaseConfig?.mode, levelConfig?.id, levelConfig?.blocks]);

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
        body: JSON.stringify({ prompt, sectionId: "section-1" }),
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
      const message = err instanceof Error ? err.message : "Something went wrong";
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
            {phaseConfig.title} · Level {progress.currentLevel}
          </div>
        </header>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{levelConfig.target}</CardTitle>
              <CardDescription>
                {phaseConfig.description ?? "Build a prompt to match the target image."}
              </CardDescription>
            </div>
            <BadgeChip>
              Phase {progress.currentPhase} of 3
            </BadgeChip>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {phaseConfig.mode === "blocks" ? (
                <BlockBuilder
                  blocks={levelConfig.blocks ?? []}
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
              <div className="flex items-center gap-3">
                <Button onClick={handleGenerate} disabled={loading || (progress.currentPhase === 3 && phase3Locked)}>
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
                    match ? "border-green-600 text-green-700" : "border-foreground"
                  }`}
                >
                  {feedback}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm uppercase text-foreground/60">Latest image</Label>
              <div className="aspect-square w-full overflow-hidden rounded-md border-4 border-foreground bg-secondary-background shadow-shadow">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Generated preview" className="h-full w-full object-cover" />
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
  const handleDrop = (block: string) => {
    onSelect([...selected, block]);
  };

  const onDragStart = (e: React.DragEvent<HTMLButtonElement>, block: string) => {
    e.dataTransfer.setData("text/plain", block);
  };

  const handlePromptDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.dataTransfer.getData("text/plain");
    if (text) onSelect([...selected, text]);
  };

  const removeAt = (idx: number) => {
    const copy = [...selected];
    copy.splice(idx, 1);
    onSelect(copy);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm uppercase text-foreground/70">Prompt blocks</Label>
      <div className="flex flex-wrap gap-2">
        {blocks.map((block) => (
          <button
            key={block}
            draggable
            onDragStart={(e) => onDragStart(e, block)}
            onClick={() => handleDrop(block)}
            className="rounded-md border-4 border-foreground bg-secondary-background px-3 py-2 text-sm font-semibold shadow-shadow transition hover:-translate-y-0.5"
          >
            {block}
          </button>
        ))}
      </div>
      <div
        className="min-h-[96px] rounded-md border-4 border-dashed border-foreground bg-secondary-background p-3 shadow-shadow"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handlePromptDrop}
      >
        <p className="text-xs uppercase text-foreground/60">Prompt bar</p>
        {selected.length === 0 && (
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            Drag blocks here, or click them to add.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((block, idx) => (
            <button
              key={`${block}-${idx}`}
              onClick={() => removeAt(idx)}
              className="rounded-md border-4 border-foreground bg-main px-2 py-1 text-xs font-semibold shadow-shadow"
            >
              {block}
            </button>
          ))}
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
