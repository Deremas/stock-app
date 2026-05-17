export function PageHeader({
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <p className="max-w-[720px] text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
    </div>
  );
}
