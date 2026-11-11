import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dishList, tableOrders } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import TableView from "./TableView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Table · tappetite", robots: { index: false, follow: false } };

export default async function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const staff = await requireStaff();
  const { tableId } = await params;
  const [table, dishes] = await Promise.all([tableOrders(staff.business_id, tableId, !staff.guide), dishList(staff.business_id)]);
  if (!table) notFound();
  return (
    <TableView
      tableId={tableId}
      initial={table}
      dishes={dishes}
      manager={staff.role === "manager" ? staff.name : null}
    />
  );
}
