import type { Metadata } from "next";
import { LockIcon } from "@/app/components/Icons";
import { restaurantLogo, restaurantName, restaurantPalette } from "@/lib/dev";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../kit";
import Shell from "../Shell";
import GuideCard from "./GuideCard";
import LogoCard from "./LogoCard";
import NameCard from "./NameCard";
import PaletteCard from "./PaletteCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "General · tappetite", robots: { index: false, follow: false } };

/** The name, logo and colours guests see. A manager sees them but only the owner changes them. */
export default async function SettingsPage() {
  const me = await requireStaff("manager");
  const [name, logoUrl, palette] = await Promise.all([
    restaurantName(me.business_id),
    restaurantLogo(me.business_id),
    restaurantPalette(me.business_id),
  ]);
  const locked = !me.owner;
  return (
    <Shell name={me.name}>
      <PageHead title="General" sub="How your menu looks to guests." />
      {locked && (
        <p className="mt-4 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_52_42/0.06)]">
          <LockIcon width={20} height={20} className="shrink-0 text-forest" />
          Only the account owner can change the name, logo and colors.
        </p>
      )}
      <NameCard name={name ?? ""} locked={locked} />
      <LogoCard name={name ?? ""} logoUrl={logoUrl} locked={locked} />
      {/* DesignCard is hidden until Designs B and C are reworked; guests all get A (lib/menu.ts). */}
      <PaletteCard palette={palette} design="a" locked={locked} />
      <GuideCard />
    </Shell>
  );
}
