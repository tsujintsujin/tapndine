import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/app/admin/kit";
import PlanCards from "@/app/components/PlanCards";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { ticket } from "@/lib/signup";
import { currentLogin } from "@/lib/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pick your plan · tapndine", robots: { index: false, follow: false } };

/**
 * Sign-up's "Buy a plan": the plan cards on a page of their own, since they
 * don't fit the login card. Needs the sign-up ticket with the restaurant's
 * name on it (app/api/auth/signup). The restaurant and the owner's login are
 * made once the plan is paid (lib/checkout.ts), and the owner is logged in.
 */
export default async function StartPlansPage() {
  if (await currentLogin()) redirect("/admin/plan");
  const t = await ticket();
  if (!t?.restaurant) redirect("/start");
  return (
    <div className="theme-green relative min-h-dvh px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] text-ink sm:px-6">
      <WarmBackdrop />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between py-2">
        <Logo href="/start" />
        <a href="/start" className="rounded font-semibold text-leaf underline-offset-4 hover:underline">
          Back
        </a>
      </header>
      <main className="relative mx-auto max-w-6xl">
        <section className="mt-6 sm:mt-10">
          <h1 className="text-balance font-display text-[34px] font-bold leading-tight tracking-tight sm:text-[44px]">
            Pick a plan for {t.restaurant}
          </h1>
          <p className="mt-2 max-w-2xl text-[17px] text-muted">
            Signed up as <span className="font-semibold text-ink">{t.email}</span>. Your restaurant is set up the moment
            your payment goes through.
          </p>
        </section>
        <div className="mt-8">
          <PlanCards />
        </div>
      </main>
    </div>
  );
}
