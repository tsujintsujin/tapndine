import type { Metadata } from "next";
import { restaurantLogo, restaurantName } from "@/lib/dev";
import { loadMenuAdmin } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff";
import Shell from "../Shell";
import MenuBoard from "./MenuBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menu · tapndine", robots: { index: false, follow: false } };

export default async function MenuPage() {
  const me = await requireStaff("manager");
  const [{ dishes, categories }, name, logoUrl] = await Promise.all([
    loadMenuAdmin(me.business_id),
    restaurantName(me.business_id),
    restaurantLogo(me.business_id),
  ]);
  return (
    <Shell name={me.name}>
      <MenuBoard dishes={dishes} categories={categories} logo={{ name: name ?? "", url: logoUrl }} />
    </Shell>
  );
}
