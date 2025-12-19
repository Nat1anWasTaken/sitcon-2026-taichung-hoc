"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useChildren, useChildStats } from "@/hooks/use-children";
import { ChildAccount } from "@/lib/types";

function StatusBadge({ status }: { status?: ChildAccount["status"] }) {
    const disabled = status === "disabled";
    return (
        <Badge variant={disabled ? "destructive" : "default"} className="capitalize">
            {disabled ? "Disabled" : "Active"}
        </Badge>
    );
}

const formatDate = (ts?: ChildAccount["lastLoginAt"]) =>
    ts ? new Date(ts).toLocaleDateString() : "Never";

export default function DashboardPage() {
    const { children, loading } = useChildren();
    const stats = useChildStats(children);
    const recent = children.slice(0, 5);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-tight text-foreground/70">Admin</p>
                    <h1 className="text-3xl font-bold leading-tight">Dashboard</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button asChild>
                        <Link href="/dashboard/children" className="gap-2">
                            Manage children
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    label="Total children"
                    value={stats.total}
                    icon={<Users className="h-5 w-5" />}
                />
                <StatCard
                    label="Active"
                    value={stats.active}
                    icon={<ShieldCheck className="h-5 w-5" />}
                />
                <StatCard label="Disabled" value={stats.disabled} tone="destructive" />
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-xl">Recent child sessions</CardTitle>
                    <Badge variant="outline">
                        {loading ? "Loading…" : `${children.length} total`}
                    </Badge>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Seat</TableHead>
                                <TableHead>Child ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last login</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recent.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-sm">
                                        {loading ? "Loading children…" : "No child accounts yet."}
                                    </TableCell>
                                </TableRow>
                            )}
                            {recent.map((child) => (
                                <TableRow key={child.childId}>
                                    <TableCell className="font-semibold">
                                        {child.seatNumber}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs uppercase">
                                        {child.childId}
                                    </TableCell>
                                    <TableCell>{child.name ?? "—"}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={child.status} />
                                    </TableCell>
                                    <TableCell>{formatDate(child.lastLoginAt)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

type StatCardProps = {
    label: string;
    value: number;
    icon?: React.ReactNode;
    tone?: "default" | "destructive";
};

function StatCard({ label, value, icon, tone = "default" }: StatCardProps) {
    const destructive = tone === "destructive";
    return (
        <Card
            className={
                destructive ? "border-destructive text-destructive shadow-shadow" : undefined
            }
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-tight">
                    {label}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}
