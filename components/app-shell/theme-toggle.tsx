"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppTheme } from "@/components/app-shell/providers";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useAppTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? SunMedium : MoonStar;
  const label = isDark ? "Light" : "Dark";
  const iconWrapClass = isDark
    ? "border-amber-300/70 bg-gradient-to-br from-amber-100 via-yellow-100 to-orange-200 text-amber-700 shadow-[0_0_18px_rgba(245,158,11,0.28)]"
    : "border-sky-200/70 bg-gradient-to-br from-slate-100 via-sky-100 to-indigo-100 text-slate-700 shadow-[0_0_18px_rgba(96,165,250,0.18)]";
  const labelClass = isDark
    ? "text-amber-700 dark:text-amber-200"
    : "text-slate-700 dark:text-slate-200";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 w-10 rounded-full border-border/70 bg-card px-0 shadow-sm transition hover:bg-accent/70 sm:w-auto sm:px-3"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border transition-transform duration-200 ${iconWrapClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className={`hidden text-xs font-semibold sm:inline sm:text-sm ${labelClass}`}>
        {label}
      </span>
    </Button>
  );
}
