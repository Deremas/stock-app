import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary", className)}>
      {getInitials(name)}
    </div>
  );
}
