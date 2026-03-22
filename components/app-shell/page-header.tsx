export function PageHeader({
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <p className="max-w-full break-words text-sm text-muted-foreground">{description}</p>
    </>
  );
}
