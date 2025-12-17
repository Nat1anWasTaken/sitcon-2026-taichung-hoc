"use client";

import { FormEvent, useState } from "react";
import { Loader2, Rabbit } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
    const router = useRouter();
    const [childId, setChildId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch("/api/child/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ childId: childId.trim(), password }),
                credentials: "include",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Login failed");
            }
            router.replace("/game");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Login failed";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Rabbit className="h-5 w-5" />
                        Child login
                    </CardTitle>
                    <CardDescription>Seat badge ID + password to enter the game.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="childId">Child ID</Label>
                            <Input
                                id="childId"
                                required
                                value={childId}
                                onChange={(e) => setChildId(e.target.value)}
                                placeholder="ABC123"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••"
                            />
                        </div>
                        {error && (
                            <div className="rounded-md border-4 border-destructive bg-secondary-background px-3 py-2 text-sm font-semibold text-destructive shadow-shadow">
                                {error}
                            </div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Checking…
                                </>
                            ) : (
                                "Start playing"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
