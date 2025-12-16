'use client';

import { FormEvent, useMemo, useState, useTransition } from "react";
import { ArrowLeft, KeyRound, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useChildren } from "@/hooks/use-children";
import {
  createChildAccount,
  resetChildPassword,
  setChildStatus,
  updateChildName,
} from "@/lib/child-accounts";
import { ChildAccount } from "@/lib/types";

const formatDate = (ts?: ChildAccount["updatedAt"]) =>
  ts ? new Date(ts.toDate()).toLocaleString() : "—";

export default function ChildrenPage() {
  const { children, loading, error } = useChildren();
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
  const [createOpen, setCreateOpen] = useState(false);
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
      return (filterStatus === "disabled" ? "disabled" : "active") === c.status ||
        (filterStatus === "active" && !c.status);
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
              Back
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-tight text-foreground/70">
              Management
            </p>
            <h1 className="text-2xl font-bold leading-tight">Child accounts</h1>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New child</Button>
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
            <CardTitle>Directory</CardTitle>
            <CardDescription>
              Toggle status, edit names, or reset passwords for children.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="status-filter" className="text-xs uppercase">
              Status
            </Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger id="status-filter" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Seat</TableHead>
                <TableHead className="w-32">Child ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm">
                    {loading ? "Loading children…" : "No children match this filter."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((child) => (
                <ChildRow key={child.childId} child={child} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && (
        <div className="rounded-md border-4 border-foreground bg-secondary-background p-5 shadow-shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Create child</h2>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Close
            </Button>
          </div>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="childId">Child ID</Label>
              <Input
                id="childId"
                required
                placeholder="ABC123"
                value={formState.childId}
                onChange={(e) => setFormState((s) => ({ ...s, childId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seatNumber">Seat number</Label>
              <Input
                id="seatNumber"
                required
                type="number"
                min={1}
                value={formState.seatNumber}
                onChange={(e) => setFormState((s) => ({ ...s, seatNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Optional name"
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                required
                type="password"
                value={formState.password}
                onChange={(e) => setFormState((s) => ({ ...s, password: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Create child"
                )}
              </Button>
              <p className="text-xs text-foreground/70">
                Admin-only: children authenticate with seat badge + password.
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ChildRow({ child }: { child: ChildAccount }) {
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
    });

  const applyReset = () =>
    startSaving(async () => {
      await resetChildPassword(child.childId, password);
      setPassword("");
      setOpenReset(false);
    });

  const toggleStatus = () =>
    startSaving(async () => {
      await setChildStatus(child.childId, disabled ? "active" : "disabled");
    });

  return (
    <>
      <TableRow>
        <TableCell className="font-semibold">{child.seatNumber}</TableCell>
        <TableCell className="font-mono text-xs uppercase">{child.childId}</TableCell>
        <TableCell>{child.name ?? "—"}</TableCell>
        <TableCell>
          <Badge variant={disabled ? "destructive" : "default"} className="capitalize">
            {disabled ? "Disabled" : "Active"}
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
                Edit name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenReset(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Reset password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleStatus}>
                {disabled ? "Enable account" : "Disable account"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {openEdit && (
        <InlineDialog title="Edit name" onClose={() => setOpenEdit(false)}>
          <div className="space-y-3">
            <Label htmlFor={`name-${child.childId}`}>Name</Label>
            <Input
              id={`name-${child.childId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button onClick={applyName} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setOpenEdit(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </InlineDialog>
      )}

      {openReset && (
        <InlineDialog title="Reset password" onClose={() => setOpenReset(false)}>
          <div className="space-y-3">
            <Label htmlFor={`pw-${child.childId}`}>New password</Label>
            <Input
              id={`pw-${child.childId}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button onClick={applyReset} disabled={saving || password.length === 0}>
                {saving ? "Updating…" : "Update password"}
              </Button>
              <Button variant="ghost" onClick={() => setOpenReset(false)}>
                Cancel
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
            Close
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
