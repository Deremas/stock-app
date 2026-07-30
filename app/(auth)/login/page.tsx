import { Package } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";
import { sanitizeReturnToPath } from "@/lib/auth/return-to";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type LoginPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeReturnToPath(getSingleSearchParam(params, "next"));

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.34),transparent_20%),linear-gradient(135deg,rgba(12,94,120,0.98),rgba(15,23,42,0.98))] lg:grid lg:grid-cols-[1fr_1fr] lg:rounded-[2rem]">
      <div className="hidden lg:block">
        <Card className="h-full overflow-hidden border-0 bg-transparent text-white shadow-none">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-6 xl:gap-6 xl:p-7">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/25 bg-white/14 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/85">
                    {APP_NAME}
                  </p>
                  <p className="text-sm text-white/78">{APP_TAGLINE}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-[13ch] text-[clamp(2rem,2.35vw,3rem)] font-semibold leading-[1.02] text-white">
                  Manage stock, sales, purchases, and cash flow in one place.
                </h1>
                <p className="max-w-md text-sm leading-6 text-white/88">
                  A focused workspace for chargers, cables, screen protectors,
                  covers, laptop accessories, and everyday shop reporting.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/18 bg-white/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] xl:p-5">
              <p className="text-base font-medium text-white xl:text-lg">Fast stock flow</p>
              <p className="mt-2 text-[13px] leading-5 text-white/82 xl:text-sm xl:leading-6">
                Receive items, sell quickly, track stock, and restock what is finished.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex h-full items-center px-4 py-4 sm:px-6 sm:py-6 lg:min-h-0 lg:bg-white/6 lg:px-4 lg:py-4 xl:px-5 xl:py-5">
        <Card className="w-full border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.98))] text-slate-950 shadow-[0_26px_70px_rgba(15,23,42,0.24)] lg:border-white/55">
          <CardContent className="p-5 sm:p-8 lg:p-6 xl:p-7">
            <div className="mx-auto max-w-md space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="rounded-2xl bg-primary/10 p-2.5 text-primary sm:p-3">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
                    <p className="text-xs text-slate-600">{APP_TAGLINE}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm leading-6 text-slate-700 lg:hidden">
                    Manage stock, sales, purchases, and cash flow in one place.
                  </p>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-primary/90">
                    Sign In
                  </p>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-[2.2rem]">
                    Welcome back
                  </h2>
                  <p className="text-sm text-slate-600">
                    Sign in to continue to your dashboard.
                  </p>
                </div>
              </div>
              <LoginForm redirectTo={redirectTo} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
