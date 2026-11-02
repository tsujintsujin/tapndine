import type { Metadata } from "next";
import { restaurantLogo, restaurantName, restaurantPalette } from "@/lib/dev";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../kit";
import Shell from "../Shell";
import LogoCard from "./LogoCard";
import PaletteCard from "./PaletteCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · tapndine", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const me = await requireStaff("manager");
  const [name, logoUrl, palette] = await Promise.all([
    restaurantName(me.business_id),
    restaurantLogo(me.business_id),
    restaurantPalette(me.business_id),
  ]);
  return (
    <Shell name={me.name}>
      <PageHead title="Settings" sub="How your menu looks to guests." />
      <LogoCard name={name ?? ""} logoUrl={logoUrl} />
      {/* DesignCard is hidden until Designs B and C are reworked; guests all get A (lib/menu.ts). */}
      <PaletteCard palette={palette} design="a" />
    </Shell>
  );
}
