'use client';

import { FormEvent, useState } from "react";
import { Loader2, ShieldCheck, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAdmin } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInAdmin(email, password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="inline-flex items-center gap-3 rounded-md border-4 border-foreground bg-secondary-background px-4 py-3 font-semibold shadow-shadow">
            <ShieldCheck className="h-5 w-5" />
            Taichung HOC · Admin portal
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Sign in to manage children and sessions
          </h1>
          <p className="max-w-2xl text-lg text-foreground/80">
            Admin accounts are provisioned in Firebase Auth (email / password). Use your
            credentials to enter the dashboard. Children never sign in here.
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <BadgePill>Firebase Auth (admins)</BadgePill>
            <BadgePill>Firestore: children collection</BadgePill>
            <BadgePill>Neobrutalism UI</BadgePill>
          </div>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5" />
              Admin sign-in
            </CardTitle>
            <CardDescription>Use the email/password from Firebase console.</CardDescription>
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
    </div>
  );
}

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border-4 border-foreground bg-secondary-background px-3 py-1 text-xs shadow-shadow">
      {children}
    </span>
  );
}
