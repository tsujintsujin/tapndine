import type { Metadata } from "next";
import { restaurantSlug } from "@/lib/dev";
import { listStaff, requireStaff } from "@/lib/staff";
import ManageStaff from "./ManageStaff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff · tapndine", robots: { index: false, follow: false } };

export default async function ManagePage() {
  const me = await requireStaff("manager");
  const [staff, slug] = await Promise.all([listStaff(me.business_id), restaurantSlug(me.business_id)]);
  return <ManageStaff me={me.id} name={me.name} slug={slug ?? ""} staff={staff} />;
}
