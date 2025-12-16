'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Sparkles, UsersRound } from "lucide-react";
import { User } from "firebase/auth";

import { AdminGate } from "@/components/admin/admin-gate";
import { Topbar } from "@/components/admin/topbar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { onAuthChange } from "@/lib/auth";

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/children", label: "Child Accounts", icon: UsersRound },
  { href: "/dashboard/cues", label: "Cues", icon: Sparkles },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <AdminGate>
      <SidebarProvider>
        <div className="flex min-h-screen bg-background text-foreground">
          <Sidebar collapsible="icon">
            <SidebarHeader className="border-b-4 border-border bg-secondary-background">
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="h-8 w-8 rounded-base bg-main shadow-shadow" />
                <div className="text-base font-semibold leading-tight">
                  Taichung HOC
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navLinks.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.href ||
                        (item.href !== "/dashboard" &&
                          pathname.startsWith(item.href));
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={active}>
                            <Link href={item.href} className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="border-t-2 border-border bg-secondary-background px-2 py-3 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase text-foreground/60">
                  Admin
                </span>
                <span>{user?.email ?? "Signed in"}</span>
              </div>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>
          <SidebarInset>
            <Topbar email={user?.email} />
            <div className="flex-1 p-6 lg:p-8">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AdminGate>
  );
}
