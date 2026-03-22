"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Building2, ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Select } from "@/components/ui/select";
import { setActiveBranchAction } from "@/lib/actions/branches";
import { getNavigationTitle } from "@/lib/constants/navigation";
import { authClient } from "@/lib/auth/client";
import type { CurrentUser } from "@/lib/types";

export function AppHeader({
  user,
  onMenuToggle,
}: {
  user: CurrentUser;
  onMenuToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSignOutPending, startSignOutTransition] = useTransition();
  const [isBranchPending, startBranchTransition] = useTransition();
  const [selectedBranchId, setSelectedBranchId] = useState(user.activeBranchId);
  const pageTitle = getNavigationTitle(pathname);
  const activeBranch =
    user.branches.find((branch) => branch.id === user.activeBranchId) ?? user.branches[0];
  const activeBranchLabel = activeBranch
    ? activeBranch.code
      ? `${activeBranch.code} - ${activeBranch.name}`
      : activeBranch.name
    : "";
  const topbarControlClass =
    "border-[hsl(var(--topbar-border)/0.9)] bg-[hsl(var(--topbar-surface-strong)/0.94)] text-[hsl(var(--topbar-foreground))] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:border-[hsl(var(--topbar-accent)/0.34)] hover:bg-[hsl(var(--topbar-surface-strong))] dark:shadow-[0_16px_32px_rgba(2,8,23,0.34)]";
  const topbarMutedTextClass = "text-[hsl(var(--topbar-muted))]";

  useEffect(() => {
    setSelectedBranchId(user.activeBranchId);
  }, [user.activeBranchId]);

  const branchControl = activeBranch ? (
    <div className="min-w-0 max-w-[8.75rem] sm:max-w-[20rem]">
      <Select
        aria-label="Switch active branch"
        className={`h-10 w-full min-w-0 rounded-full px-3 text-sm font-medium sm:h-auto sm:rounded-2xl sm:py-2 ${topbarControlClass} [&_svg]:text-[hsl(var(--topbar-muted))]`}
        disabled={isBranchPending || user.branches.length <= 1}
        triggerLabel={
          <>
            <span className="block truncate text-sm font-medium sm:hidden">{activeBranch.name}</span>
            <span className="hidden min-w-0 items-center gap-2 sm:flex">
              <Building2 className="h-4 w-4 shrink-0 text-[hsl(var(--topbar-accent))]" />
              <span className="min-w-0">
                <span className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${topbarMutedTextClass}`}>
                  Active Branch
                </span>
                <span className="block truncate text-sm font-medium text-[hsl(var(--topbar-foreground))]">
                  {activeBranchLabel}
                </span>
              </span>
            </span>
          </>
        }
        value={selectedBranchId}
        onChange={(event) => {
          const nextBranchId = event.target.value;

          if (!nextBranchId || nextBranchId === user.activeBranchId) {
            setSelectedBranchId(user.activeBranchId);
            return;
          }

          setSelectedBranchId(nextBranchId);
          startBranchTransition(async () => {
            const result = await setActiveBranchAction({
              branchId: nextBranchId,
            });

            if (!result.success) {
              setSelectedBranchId(user.activeBranchId);
              toast.error(result.message);
              return;
            }

            toast.success(result.message);
            router.refresh();
          });
        }}
      >
        {user.branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.code} - {branch.name}
          </option>
        ))}
      </Select>
    </div>
  ) : user.role === "ADMIN" ? (
    pathname === "/admin/branches" ? null : (
      <Button
        asChild
        size="sm"
        variant="outline"
        className={`h-10 rounded-full px-3 ${topbarControlClass}`}
      >
        <Link href="/admin/branches" prefetch={false}>
          Create first branch
        </Link>
      </Button>
    )
  ) : (
    <div
      className={`rounded-full border border-dashed px-3 py-2 text-sm ${topbarControlClass} ${topbarMutedTextClass}`}
    >
      No branch created yet
    </div>
  );

  function handleSignOut() {
    startSignOutTransition(async () => {
      try {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      } catch {
        toast.error("Unable to sign out right now.");
      }
    });
  }

  return (
    <header className="sticky top-0 z-30 max-w-full shrink-0 overflow-x-clip border-b border-[hsl(var(--topbar-border)/0.86)] bg-[linear-gradient(135deg,hsl(var(--topbar-surface)/0.96),hsl(var(--topbar-surface-strong)/0.92))] px-4 py-3 text-[hsl(var(--topbar-foreground))] shadow-[0_14px_32px_rgba(14,116,144,0.12)] backdrop-blur supports-[backdrop-filter]:bg-[linear-gradient(135deg,hsl(var(--topbar-surface)/0.9),hsl(var(--topbar-surface-strong)/0.84))] dark:shadow-[0_20px_40px_rgba(2,8,23,0.4)]">
      <div className="mx-auto w-full min-w-0 max-w-[1360px]">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`h-10 w-10 rounded-2xl ${topbarControlClass}`}
              onClick={onMenuToggle}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-semibold tracking-tight text-[hsl(var(--topbar-foreground))] sm:text-lg">
              {pageTitle}
            </h1>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            {branchControl}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex max-w-full items-center gap-3 rounded-full px-3 py-2 ${topbarControlClass}`}
                >
                  <Avatar name={user.name} />
                  <div className="hidden text-left sm:block">
                    <p className="max-w-[8rem] truncate text-sm font-medium text-[hsl(var(--topbar-foreground))]">
                      {user.name}
                    </p>
                    <p className={`text-xs ${topbarMutedTextClass}`}>{user.role}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 ${topbarMutedTextClass}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user.username}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/profile")}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={isSignOutPending} onSelect={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {isSignOutPending ? "Signing out..." : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
