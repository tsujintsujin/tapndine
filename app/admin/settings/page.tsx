import type { Metadata } from "next";
import { restaurantDesign, restaurantLogo, restaurantName, restaurantPalette } from "@/lib/dev";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../kit";
import Shell from "../Shell";
import DesignCard from "./DesignCard";
import LogoCard from "./LogoCard";
import PaletteCard from "./PaletteCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · tapndine", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const me = await requireStaff("manager");
  const [name, logoUrl, design, palette] = await Promise.all([
    restaurantName(me.business_id),
    restaurantLogo(me.business_id),
    restaurantDesign(me.business_id),
    restaurantPalette(me.business_id),
  ]);
  return (
    <Shell name={me.name}>
      <PageHead title="Settings" sub="How your menu looks to guests." />
      <LogoCard name={name ?? ""} logoUrl={logoUrl} />
      <DesignCard design={design} />
      {/* Keyed by design: with no palette picked, the tick follows the design's own colours. */}
      <PaletteCard key={design} palette={palette} design={design} />
    </Shell>
  );
}
