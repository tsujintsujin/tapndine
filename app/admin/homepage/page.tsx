import type { Metadata } from "next";
import { loadMenuAdmin } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff";
import Shell from "../Shell";
import HomepageEditor from "./HomepageEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage · tapndine", robots: { index: false, follow: false } };

export default async function HomepagePage() {
  const me = await requireStaff("manager");
  const { dishes } = await loadMenuAdmin(me.business_id);
  return (
    <Shell name={me.name}>
      <HomepageEditor
        dishes={dishes.map((d) => ({
          id: d.id,
          name: d.name,
          imageUrl: d.imageUrl,
          priceCents: d.priceCents,
          available: d.available,
          featured: d.featured,
          bestSeller: d.bestSeller,
          isNew: d.isNew,
        }))}
      />
    </Shell>
  );
}
