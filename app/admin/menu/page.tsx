import type { Metadata } from "next";
import { loadMenuAdmin } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff";
import Shell from "../Shell";
import MenuBoard from "./MenuBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menu · tappetite", robots: { index: false, follow: false } };

export default async function MenuPage() {
  const me = await requireStaff("manager");
  const { dishes, categories } = await loadMenuAdmin(me.business_id);
  return (
    <Shell name={me.name}>
      <MenuBoard dishes={dishes} categories={categories} />
    </Shell>
  );
}
