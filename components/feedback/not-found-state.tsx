import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NotFoundStateProps = {
  fullScreen?: boolean;
  className?: string;
};

export function NotFoundState({
  fullScreen = false,
  className,
}: NotFoundStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 py-10 sm:px-6",
        fullScreen ? "min-h-screen" : "min-h-[65vh]",
        className,
      )}
    >
      <Card className="max-w-xl bg-card/95">
        <CardHeader className="space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-primary/10 text-primary shadow-sm">
            <SearchX className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              404 Error
            </p>
            <CardTitle className="text-3xl">Page not found</CardTitle>
            <CardDescription className="text-base leading-7">
              The page you requested is not available. Return to the dashboard to
              keep working from the main screen.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
