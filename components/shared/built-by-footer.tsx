import Link from "next/link";
import { Github } from "lucide-react";

import { cn } from "@/lib/utils";

export function BuiltByFooter({
  tone = "default",
  className,
}: {
  tone?: "default" | "inverse";
  className?: string;
}) {
  const textClassName =
    tone === "inverse" ? "text-white/78" : "text-muted-foreground";
  const linkClassName =
    tone === "inverse"
      ? "text-white hover:text-white"
      : "text-foreground hover:text-primary";

  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm",
        textClassName,
        className,
      )}
    >
      <span>Built by</span>
      <Link
        href="https://github.com/Deremas"
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 font-medium transition-colors",
          linkClassName,
        )}
      >
        <Github className="h-4 w-4" />
        Dereje M.
      </Link>
    </footer>
  );
}
