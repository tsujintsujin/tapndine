import type { Metadata } from "next";
import { restaurantSlug } from "@/lib/dev";
import { listStaff, requireStaff } from "@/lib/staff";
import { tableLimit } from "@/lib/tables";
import ManageStaff from "./ManageStaff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff · tappetite", robots: { index: false, follow: false } };

export default async function ManagePage() {
  const me = await requireStaff("manager");
  const [staff, slug, limit] = await Promise.all([
    listStaff(me.business_id),
    restaurantSlug(me.business_id),
    tableLimit(me.business_id),
  ]);
  // The Single plan has no tables, so no ordering and no waiters (Justin, 2026-11-12).
  return <ManageStaff me={me.id} name={me.name} slug={slug ?? ""} staff={staff} owner={me.owner} canAddWaiters={limit > 0} />;
}
