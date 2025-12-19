"use client";

import {
    ArrowLeft,
    Flag,
    KeyRound,
    Loader2,
    MoreHorizontal,
    Pencil,
    SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useChildProgress } from "@/hooks/use-child-progress";
import { useChildren } from "@/hooks/use-children";
import { useGardenContent } from "@/hooks/use-garden";
import {
    createChildAccount,
    resetChildPassword,
    setChildStatus,
    updateChildName,
} from "@/lib/child-accounts";
import { getDefaultSectionProgress, saveChildSectionProgress } from "@/lib/child-progress";
import { SectionProgress } from "@/lib/game-types";
import { SECTION_ONE_ID, buildSectionConfigFromRecords } from "@/lib/game/config";
import { ChildAccount } from "@/lib/types";

const formatDate = (ts?: ChildAccount["updatedAt"]) => (ts ? new Date(ts).toLocaleString() : "—");

export default function ChildrenPage() {
    const { children, loading, error, refresh } = useChildren();
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
    const [createOpen, setCreateOpen] = useState(false);
    const [progressChild, setProgressChild] = useState<ChildAccount | null>(null);
    const [formState, setFormState] = useState({
        childId: "",
        seatNumber: "",
        password: "",
        name: "",
    });
    const [message, setMessage] = useState<string | null>(null);
    const [busy, startBusy] = useTransition();

    const filtered = useMemo(() => {
        return children.filter((c) => {
            if (filterStatus === "all") return true;
            return (
                (filterStatus === "disabled" ? "disabled" : "active") === c.status ||
                (filterStatus === "active" && !c.status)
            );
        });
    }, [children, filterStatus]);

    const handleCreate = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        startBusy(async () => {
            try {
                await createChildAccount({
                    childId: formState.childId.trim(),
                    seatNumber: Number(formState.seatNumber),
                    password: formState.password,
                    name: formState.name || undefined,
                });
                setMessage("Child account created");
                setFormState({ childId: "", seatNumber: "", password: "", name: "" });
                setCreateOpen(false);
                await refresh();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to create child";
                setMessage(message);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="sm" className="-ml-2">
                        <Link href="/dashboard" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            返回
                        </Link>
                    </Button>
                    <div>
                        <p className="text-xs uppercase tracking-tight text-foreground/70">管理</p>
                        <h1 className="text-2xl font-bold leading-tight">學生帳號</h1>
                    </div>
                </div>
                <Button onClick={() => setCreateOpen(true)}>新增學生</Button>
            </div>

            {message && (
                <div className="rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 text-sm font-semibold shadow-shadow">
                    {message}
                </div>
            )}
            {error && (
                <div className="rounded-md border-4 border-destructive bg-secondary-background px-4 py-3 text-sm font-semibold text-destructive shadow-shadow">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>目錄</CardTitle>
                        <CardDescription>切換狀態、編輯名稱或重設學生密碼。</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="status-filter" className="text-xs uppercase">
                            狀態
                        </Label>
                        <Select
                            value={filterStatus}
                            onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
                        >
                            <SelectTrigger id="status-filter" className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部</SelectItem>
                                <SelectItem value="active">啟用</SelectItem>
                                <SelectItem value="disabled">停用</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16">座位</TableHead>
                                <TableHead className="w-32">學生 ID</TableHead>
                                <TableHead>姓名</TableHead>
                                <TableHead>狀態</TableHead>
                                <TableHead>上次更新</TableHead>
                                <TableHead className="w-16">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-sm">
                                        {loading ? "載入學生…" : "沒有符合篩選的學生。"}
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered.map((child) => (
                                <ChildRow
                                    key={child.childId}
                                    child={child}
                                    onProgress={() => setProgressChild(child)}
                                    refresh={refresh}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {createOpen && (
                <div className="rounded-md border-4 border-foreground bg-secondary-background p-5 shadow-shadow">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">建立學生</h2>
                        <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                            關閉
                        </Button>
                    </div>
                    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
                        <div className="space-y-2">
                            <Label htmlFor="childId">學生 ID</Label>
                            <Input
                                id="childId"
                                required
                                placeholder="ABC123"
                                value={formState.childId}
                                onChange={(e) =>
                                    setFormState((s) => ({ ...s, childId: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="seatNumber">座位號碼</Label>
                            <Input
                                id="seatNumber"
                                required
                                type="number"
                                min={1}
                                value={formState.seatNumber}
                                onChange={(e) =>
                                    setFormState((s) => ({ ...s, seatNumber: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">姓名</Label>
                            <Input
                                id="name"
                                placeholder="選填名稱"
                                value={formState.name}
                                onChange={(e) =>
                                    setFormState((s) => ({ ...s, name: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">密碼</Label>
                            <Input
                                id="password"
                                required
                                type="password"
                                value={formState.password}
                                onChange={(e) =>
                                    setFormState((s) => ({ ...s, password: e.target.value }))
                                }
                            />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-3">
                            <Button type="submit" disabled={busy}>
                                {busy ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> 建立中…
                                    </>
                                ) : (
                                    "建立學生"
                                )}
                            </Button>
                            <p className="text-xs text-foreground/70">
                                僅限管理員：學生以座位徽章 + 密碼登入。
                            </p>
                        </div>
                    </form>
                </div>
            )}

            <ProgressSheet
                child={progressChild}
                open={!!progressChild}
                onOpenChange={(open) => {
                    if (!open) setProgressChild(null);
                }}
            />
        </div>
    );
}

function ChildRow({
    child,
    onProgress,
    refresh,
}: {
    child: ChildAccount;
    onProgress: () => void;
    refresh: () => Promise<void>;
}) {
    const [openEdit, setOpenEdit] = useState(false);
    const [openReset, setOpenReset] = useState(false);
    const [name, setName] = useState(child.name ?? "");
    const [password, setPassword] = useState("");
    const [saving, startSaving] = useTransition();
    const disabled = child.status === "disabled";

    const applyName = () =>
        startSaving(async () => {
            await updateChildName(child.childId, name.trim());
            setOpenEdit(false);
            await refresh();
        });

    const applyReset = () =>
        startSaving(async () => {
            await resetChildPassword(child.childId, password);
            setPassword("");
            setOpenReset(false);
            await refresh();
        });

    const toggleStatus = () =>
        startSaving(async () => {
            await setChildStatus(child.childId, disabled ? "active" : "disabled");
            await refresh();
        });

    return (
        <>
            <TableRow>
                <TableCell className="font-semibold">{child.seatNumber}</TableCell>
                <TableCell className="font-mono text-xs uppercase">{child.childId}</TableCell>
                <TableCell>{child.name ?? "—"}</TableCell>
                <TableCell>
                    <Badge variant={disabled ? "destructive" : "default"} className="capitalize">
                        {disabled ? "已停用" : "啟用"}
                    </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(child.updatedAt)}</TableCell>
                <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setOpenEdit(true)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                編輯名稱
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setOpenReset(true)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                重設密碼
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onProgress}>
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                進度
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={toggleStatus}>
                                {disabled ? "啟用帳號" : "停用帳號"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>

            {openEdit && (
                <InlineDialog title="編輯名稱" onClose={() => setOpenEdit(false)}>
                    <div className="space-y-3">
                        <Label htmlFor={`name-${child.childId}`}>姓名</Label>
                        <Input
                            id={`name-${child.childId}`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                            <Button onClick={applyName} disabled={saving}>
                                {saving ? "儲存中…" : "儲存"}
                            </Button>
                            <Button variant="ghost" onClick={() => setOpenEdit(false)}>
                                取消
                            </Button>
                        </div>
                    </div>
                </InlineDialog>
            )}

            {openReset && (
                <InlineDialog title="重設密碼" onClose={() => setOpenReset(false)}>
                    <div className="space-y-3">
                        <Label htmlFor={`pw-${child.childId}`}>新密碼</Label>
                        <Input
                            id={`pw-${child.childId}`}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                            <Button onClick={applyReset} disabled={saving || password.length === 0}>
                                {saving ? "更新中…" : "更新密碼"}
                            </Button>
                            <Button variant="ghost" onClick={() => setOpenReset(false)}>
                                取消
                            </Button>
                        </div>
                    </div>
                </InlineDialog>
            )}
        </>
    );
}

function InlineDialog({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay/30 p-4">
            <div className="w-full max-w-md rounded-md border-4 border-foreground bg-secondary-background p-5 shadow-shadow">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        關閉
                    </Button>
                </div>
                <div className="mt-4">{children}</div>
            </div>
        </div>
    );
}

function ProgressSheet({
    child,
    open,
    onOpenChange,
}: {
    child: ChildAccount | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { phases, levels, loading: gardenLoading } = useGardenContent();

    const sections = useMemo(() => {
        if (phases.length === 0) return [];
        return [buildSectionConfigFromRecords(SECTION_ONE_ID, "花園創建者", phases, levels)];
    }, [phases, levels]);

    const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
    const { progress, loading, error } = useChildProgress(child?.childId ?? "", sectionIds);
    const [drafts, setDrafts] = useState<Record<string, SectionProgress>>({});
    const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!open) {
            setInitialized(false);
            return;
        }
        // Initialize drafts only once when data is ready to prevent overwriting edits
        if (child && !loading && !initialized) {
            setDrafts(progress);
            setInitialized(true);
            setNotice(null);
        }
    }, [open, child, loading, initialized, progress]);

    if (!child) return null;

    const updateDraft = (
        sectionId: string,
        updater: (curr: SectionProgress) => SectionProgress
    ) => {
        setDrafts((prev) => {
            const curr = prev[sectionId] ?? getDefaultSectionProgress(sectionId);
            return {
                ...prev,
                [sectionId]: updater(curr),
            };
        });
    };

    const handleSave = async (sectionId: string) => {
        const payload = drafts[sectionId] ?? getDefaultSectionProgress(sectionId);
        setBusyId(sectionId);
        setNotice(null);

        // Dynamically collect all phase completion flags
        const phaseFlags: Record<string, boolean> = {};
        Object.keys(payload).forEach((key) => {
            if (key.startsWith("phase") && key.endsWith("Complete")) {
                // @ts-expect-error - allowing dynamic access for flexible phase support
                phaseFlags[key] = payload[key];
            }
        });

        try {
            await saveChildSectionProgress(child.childId, sectionId, {
                currentLevel: payload.currentLevel,
                currentPhase: payload.currentPhase,
                sectionComplete: payload.sectionComplete ?? false,
                ...phaseFlags,
            });
            setNotice({ tone: "info", text: "Progress updated." });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save progress.";
            setNotice({ tone: "error", text: message });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="sm:max-w-xl">
                <SheetHeader className="border-b-4 border-border bg-secondary-background">
                    <SheetTitle>Progress controls</SheetTitle>
                    <SheetDescription>
                        Fine-tune phases and levels for {child.name ?? child.childId}.
                    </SheetDescription>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-foreground/60">
                        <Badge variant="outline" className="border-2">
                            Seat {child.seatNumber}
                        </Badge>
                        <Badge variant="neutral" className="border-2 font-mono uppercase">
                            {child.childId}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="space-y-4 p-4">
                    {gardenLoading && (
                        <div className="flex items-center gap-2 text-sm text-foreground/70">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading game configuration…
                        </div>
                    )}

                    {!gardenLoading && sections.length === 0 && (
                        <div className="rounded-md border-4 border-destructive bg-secondary-background px-4 py-3 text-sm font-semibold text-destructive shadow-shadow">
                            Error: No game content found. Please go to Garden/Levels configuration
                            to create entries.
                        </div>
                    )}

                    {notice && (
                        <div
                            className={`rounded-md border-4 px-3 py-2 text-sm font-semibold shadow-shadow ${
                                notice.tone === "error"
                                    ? "border-destructive text-destructive bg-secondary-background"
                                    : "border-foreground bg-secondary-background"
                            }`}
                        >
                            {notice.text}
                        </div>
                    )}
                    {error && (
                        <div className="rounded-md border-4 border-destructive bg-secondary-background px-3 py-2 text-sm font-semibold text-destructive shadow-shadow">
                            {error}
                        </div>
                    )}

                    {sections.map((section) => {
                        const draft = drafts[section.id] ?? getDefaultSectionProgress(section.id);
                        const activePhase = section.phases[draft.currentPhase - 1];
                        const levels = activePhase?.levels ?? [];
                        return (
                            <Card key={section.id}>
                                <CardHeader className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Flag className="h-4 w-4 text-foreground/70" />
                                        <CardTitle className="text-lg">{section.title}</CardTitle>
                                    </div>
                                    <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                                        <span>
                                            Phase {draft.currentPhase} · Level {draft.currentLevel}{" "}
                                            {loading ? "(loading…)" : ""}
                                        </span>
                                        {draft.sectionComplete && (
                                            <Badge variant="default" className="border-2">
                                                Section complete
                                            </Badge>
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Phase</Label>
                                            <Select
                                                value={String(draft.currentPhase)}
                                                onValueChange={(v) =>
                                                    updateDraft(section.id, (curr) => ({
                                                        ...curr,
                                                        currentPhase: Number(
                                                            v
                                                        ) as SectionProgress["currentPhase"],
                                                        currentLevel: 1,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {section.phases.map((phase, idx) => (
                                                        <SelectItem
                                                            key={phase.id}
                                                            value={String(idx + 1)}
                                                        >
                                                            Phase {idx + 1} — {phase.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Level</Label>
                                            <Select
                                                value={String(draft.currentLevel)}
                                                onValueChange={(v) =>
                                                    updateDraft(section.id, (curr) => ({
                                                        ...curr,
                                                        currentLevel: Number(v),
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {levels.map((level, idx) => (
                                                        <SelectItem
                                                            key={level.id}
                                                            value={String(idx + 1)}
                                                        >
                                                            Level {idx + 1} — {level.target}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2 rounded-md border-2 border-border bg-secondary-background p-3 shadow-shadow">
                                        <p className="text-xs font-semibold uppercase text-foreground/70">
                                            Phase completion
                                        </p>
                                        <div className="space-y-2">
                                            {section.phases.map((phase, idx) => {
                                                const key =
                                                    `phase${idx + 1}Complete` as keyof SectionProgress;
                                                return (
                                                    <div
                                                        key={phase.id}
                                                        className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-semibold">
                                                                Phase {idx + 1}: {phase.title}
                                                            </div>
                                                            <div className="text-xs text-foreground/70">
                                                                Mark complete to skip gates.
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={!!draft[key]}
                                                            onCheckedChange={(checked) =>
                                                                updateDraft(section.id, (curr) => ({
                                                                    ...curr,
                                                                    [key]: checked,
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-2 rounded-md border-2 border-border bg-secondary-background p-3 shadow-shadow">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    Mark section as complete
                                                </p>
                                                <p className="text-xs text-foreground/70">
                                                    Locks Section 1 for this child and signals
                                                    readiness for the next section.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={!!draft.sectionComplete}
                                                onCheckedChange={(checked) =>
                                                    updateDraft(section.id, (curr) => ({
                                                        ...curr,
                                                        sectionComplete: checked,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() =>
                                                updateDraft(section.id, () =>
                                                    getDefaultSectionProgress(section.id)
                                                )
                                            }
                                            disabled={busyId === section.id}
                                        >
                                            Reset to start
                                        </Button>
                                        <div className="flex-1" />
                                        <Button
                                            onClick={() => handleSave(section.id)}
                                            disabled={busyId === section.id}
                                        >
                                            {busyId === section.id ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Saving…
                                                </>
                                            ) : (
                                                "Save changes"
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </SheetContent>
        </Sheet>
    );
}
