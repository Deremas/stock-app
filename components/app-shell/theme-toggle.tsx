"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? SunMedium : MoonStar;
  const label = isDark ? "Light" : "Dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 rounded-full border-border/70 bg-card px-3 shadow-sm"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-semibold sm:text-sm">{label}</span>
    </Button>
  );
}
