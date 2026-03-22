"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-shell/header";
import { AppSidebar } from "@/components/app-shell/sidebar";
import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  function handleSidebarToggle() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopSidebarOpen((current) => !current);
      return;
    }

    setMobileSidebarOpen((current) => !current);
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-background">
      <AppSidebar
        role={user.role}
        desktopOpen={desktopSidebarOpen}
        mobileOpen={mobileSidebarOpen}
        onNavigate={() => setMobileSidebarOpen(false)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div
        className={cn(
          "flex min-h-screen min-w-0 max-w-full flex-1 flex-col overflow-x-clip transition-[margin] duration-200",
          desktopSidebarOpen ? "lg:ml-72" : "lg:ml-0",
        )}
      >
        <AppHeader
          user={user}
          onMenuToggle={handleSidebarToggle}
        />
        <main className="flex-1 min-w-0 max-w-full overflow-x-clip px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-6">
          <div className="mx-auto flex w-full min-w-0 max-w-[1360px] flex-col gap-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
