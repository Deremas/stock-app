"use client";

import type { Route } from "next";
import Link from "next/link";
import { ChevronDown, Package, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import {
  getOpenGroupForPath,
  getVisibleNavigation,
} from "@/lib/constants/navigation";
import { getIcon } from "@/lib/icons";
import type { AppRole } from "@/lib/rbac";
import { APP_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";

function getSectionAccent(title: string) {
  const accents: Record<string, string> = {
    Dashboard: "text-cyan-700 dark:text-cyan-300",
    Inventory: "text-violet-600 dark:text-violet-300",
    Sales: "text-emerald-600 dark:text-emerald-300",
    Purchases: "text-amber-600 dark:text-amber-300",
    Sellers: "text-sky-600 dark:text-sky-300",
    Expenses: "text-rose-600 dark:text-rose-300",
    Finance: "text-cyan-600 dark:text-cyan-300",
    Reports: "text-purple-600 dark:text-purple-300",
    Administration: "text-slate-600 dark:text-slate-300",
  };

  return accents[title] ?? "text-primary";
}

export function AppSidebar({
  role,
  desktopOpen,
  mobileOpen,
  onNavigate,
  onCloseMobile,
}: {
  role: AppRole;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const entries = useMemo(() => getVisibleNavigation(role), [role]);
  const [openGroup, setOpenGroup] = useState<string | null>(
    getOpenGroupForPath(pathname, role),
  );

  useEffect(() => {
    const activeGroup = getOpenGroupForPath(pathname, role);
    if (activeGroup) {
      setOpenGroup(activeGroup);
    }
  }, [pathname, role]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[1px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-64 max-w-[calc(100vw-2rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 lg:z-40 lg:shadow-[6px_0_24px_rgba(15,23,42,0.04)]",
          desktopOpen ? "lg:translate-x-0" : "lg:-translate-x-full",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-bold tracking-tight">{APP_NAME}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/45">Accessories</p>
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-primary/10 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {entries.map((entry) => {
              const Icon = getIcon(entry.icon);
              const accentClass = getSectionAccent(entry.title);

              if (entry.type === "link") {
                const active =
                  pathname === entry.href || pathname.startsWith(`${entry.href}/`);

                return (
                  <div
                    key={entry.href}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition-all duration-200",
                      active
                        ? "border-transparent"
                        : "border-transparent hover:border-sidebar-border/50",
                    )}
                  >
                    <Link
                      href={entry.href as Route}
                      prefetch={false}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15 dark:bg-white/10 dark:text-white dark:ring-white/15"
                          : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground dark:hover:bg-white/5 dark:hover:text-white",
                      )}
                      onClick={onNavigate}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary dark:text-white" : accentClass)} />
                      <span className="truncate">{entry.title}</span>
                    </Link>
                  </div>
                );
              }

              const groupActive = entry.items.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
              );
              const expanded = openGroup === entry.title;

              return (
                <div
                  key={entry.title}
                  className={cn(
                    "overflow-hidden rounded-2xl border transition-all duration-200",
                    groupActive &&
                      expanded &&
                      "border-primary/15 bg-primary/5 shadow-sm dark:border-white/10 dark:bg-white/5",
                    groupActive &&
                      !expanded &&
                      "border-transparent",
                    !groupActive &&
                      expanded &&
                      "border-sidebar-border bg-muted/70 shadow-sm dark:bg-white/5",
                    !groupActive && !expanded && "border-transparent hover:border-sidebar-border/50"
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200",
                      groupActive
                        ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15 dark:bg-white/10 dark:text-white dark:ring-white/10"
                        : expanded
                          ? "text-sidebar-foreground"
                          : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground dark:hover:bg-white/5 dark:hover:text-white",
                    )}
                    onClick={() =>
                      setOpenGroup((current) =>
                        current === entry.title ? null : entry.title,
                      )
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-8 w-1 shrink-0 rounded-full transition-all duration-200",
                        groupActive
                          ? "bg-primary shadow-[0_0_8px_rgba(14,116,144,0.35)]"
                          : expanded
                            ? "bg-sidebar-foreground/20"
                            : "bg-transparent",
                      )}
                    />
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        groupActive ? "text-primary dark:text-white" : accentClass,
                      )}
                    />
                    <span className="flex-1">{entry.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-all duration-200",
                        groupActive && "text-primary dark:text-white",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded ? (
                    <div
                      className={cn(
                        "space-y-1 px-2 pb-2 pt-1",
                        groupActive && "border-t border-sidebar-border/60 bg-transparent",
                      )}
                    >
                      {entry.items.map((item) => {
                        const ItemIcon = getIcon(item.icon);
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);

                        return (
                          <Link
                            key={item.href}
                            href={item.href as Route}
                            prefetch={false}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                              active
                                ? "bg-primary/10 font-medium text-primary shadow-sm ring-1 ring-primary/15 dark:bg-white/10 dark:text-white dark:ring-white/15"
                                : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground dark:hover:bg-white/5 dark:hover:text-white",
                            )}
                            onClick={onNavigate}
                          >
                            <ItemIcon className={cn("h-4 w-4 shrink-0", active ? "text-primary dark:text-white" : accentClass)} />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>
      </aside>
    </>
  );
}
