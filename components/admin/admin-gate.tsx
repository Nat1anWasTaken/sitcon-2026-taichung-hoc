'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { User } from "firebase/auth";

import { onAuthChange } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export function AdminGate({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (checked && !user) {
      router.replace("/");
    }
  }, [checked, user, router]);

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
    // Redirecting
    return null;
  }

  return children;
}
