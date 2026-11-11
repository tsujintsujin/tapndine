import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadMenuAdmin } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff";
import Shell from "../../Shell";
import CategoryEditor from "../CategoryEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Category · tappetite", robots: { index: false, follow: false } };

/** One category: its name and which dishes are in it. */
export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const me = await requireStaff("manager");
  const { categoryId } = await params;
  const { dishes, categories } = await loadMenuAdmin(me.business_id);
  const category = categories.find((c) => c.id === categoryId);
  if (!category) notFound();
  return (
    <Shell name={me.name}>
      <CategoryEditor category={category} categories={categories} dishes={dishes} />
    </Shell>
  );
}
