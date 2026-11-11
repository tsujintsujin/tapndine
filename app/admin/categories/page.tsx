import type { Metadata } from "next";
import { loadMenuAdmin } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff";
import Shell from "../Shell";
import CategoryBoard from "./CategoryBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categories · tappetite", robots: { index: false, follow: false } };

export default async function CategoriesPage() {
  const me = await requireStaff("manager");
  const { dishes, categories } = await loadMenuAdmin(me.business_id);
  return (
    <Shell name={me.name}>
      <CategoryBoard categories={categories} dishes={dishes} />
    </Shell>
  );
}
