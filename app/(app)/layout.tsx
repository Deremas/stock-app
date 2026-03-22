import { AppShell } from "@/components/app-shell/app-shell";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { canAccessPath } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireSession();
  const requestHeaders = await headers();
  const requestedPath = requestHeaders.get("x-return-to") ?? "/dashboard";
  const pathname = requestedPath.split("?")[0] || "/dashboard";

  if (!canAccessPath(user.role, pathname)) {
    redirect("/dashboard");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
