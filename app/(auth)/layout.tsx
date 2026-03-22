import { redirect } from "next/navigation";

import { BuiltByFooter } from "@/components/shared/built-by-footer";
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
    <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,252,1))] px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex h-full w-full flex-col sm:max-w-5xl lg:max-h-[calc(100dvh-4.25rem)]">
        <div className="min-h-0 flex-1 sm:rounded-[2rem] sm:border sm:border-white/80 sm:bg-white/92 sm:p-4 sm:shadow-[0_28px_80px_rgba(15,23,42,0.12)] sm:backdrop-blur lg:p-4 xl:p-5">
          {children}
        </div>
      </div>
      <BuiltByFooter className="pointer-events-auto absolute bottom-3 left-1/2 hidden -translate-x-1/2 justify-center lg:flex" />
    </main>
  );
}
