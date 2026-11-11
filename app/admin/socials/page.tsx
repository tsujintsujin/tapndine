import type { Metadata } from "next";
import { restaurantSocials } from "@/lib/dev";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../kit";
import Shell from "../Shell";
import SocialsBoard from "./SocialsBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Socials · tappetite", robots: { index: false, follow: false } };

/** Settings > Socials: the pages guests see under "Follow us" on the menu. */
export default async function SocialsPage() {
  const me = await requireStaff("manager");
  return (
    <Shell name={me.name}>
      <PageHead title="Socials" sub="Your pages, shown under “Follow us” on your menu. Only the ones switched on show." />
      <SocialsBoard initial={await restaurantSocials(me.business_id)} />
    </Shell>
  );
}
