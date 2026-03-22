import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,252,1))] px-4 py-6 sm:px-4 sm:py-12">
      <div className="w-full sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-white/80 sm:bg-white/92 sm:p-4 sm:shadow-[0_28px_80px_rgba(15,23,42,0.12)] sm:backdrop-blur md:sm:p-8">
        {children}
      </div>
    </main>
  );
}
