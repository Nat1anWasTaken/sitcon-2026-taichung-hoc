"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserCircle2 } from "lucide-react";
import type { User } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onAuthChange, signInAdmin } from "@/lib/auth";

type Props = {
    children: React.ReactNode;
};

export function AdminGate({ children }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [checked, setChecked] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsub = onAuthChange((u) => {
            setUser(u);
            setChecked(true);
        });
        return () => unsub();
    }, []);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signInAdmin(email, password);
            // Auth state will update via onAuthChange
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Sign-in failed";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (!checked) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex items-center gap-3 rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 shadow-shadow">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-semibold">Checking admin session…</span>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="mb-3 inline-flex items-center gap-3 rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
                            <ShieldCheck className="h-5 w-5" />
                            Admin Portal
                        </div>
                        <CardTitle className="flex items-center gap-2">
                            <UserCircle2 className="h-5 w-5" />
                            Admin sign-in
                        </CardTitle>
                        <CardDescription>
                            Use the email/password from Firebase console.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                                        Signing in…
                                    </>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return children;
}
