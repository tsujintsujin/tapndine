import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadMenuAdmin } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff";
import Shell from "../../Shell";
import DishEditor from "../DishEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dish · tapndine", robots: { index: false, follow: false } };

/** /admin/menu/new adds a dish; /admin/menu/<id> edits one. */
export default async function DishPage({ params }: { params: Promise<{ dishId: string }> }) {
  const me = await requireStaff("manager");
  const { dishId } = await params;
  const { dishes, categories } = await loadMenuAdmin(me.business_id);
  const dish = dishId === "new" ? null : dishes.find((d) => d.id === dishId);
  if (dish === undefined) notFound();
  const hero = dishes.find((d) => d.featured && d.id !== dishId);
  return (
    <Shell name={me.name}>
      <DishEditor dish={dish} categories={categories} currentHero={hero?.name ?? null} />
    </Shell>
  );
}
