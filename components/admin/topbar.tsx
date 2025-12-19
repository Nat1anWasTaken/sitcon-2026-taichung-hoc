"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { signOutAdmin } from "@/lib/auth";

type Props = {
    email?: string | null;
};

export function Topbar({ email }: Props) {
    const router = useRouter();

    const handleSignOut = async () => {
        await signOutAdmin();
        router.replace("/");
    };

    return (
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-4 border-foreground bg-secondary-background px-4 shadow-nav">
            <div className="flex items-center gap-3">
                <SidebarTrigger className="md:hidden" />
                <div className="text-sm font-semibold uppercase tracking-tight">管理員儀表板</div>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden text-xs font-semibold sm:block">{email ?? "已登入"}</div>
                <Button variant="secondary" size="sm" className="gap-2" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    登出
                </Button>
            </div>
        </header>
    );
}
