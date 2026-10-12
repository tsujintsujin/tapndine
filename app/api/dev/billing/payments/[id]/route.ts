import { NextResponse } from "next/server";
import { deletePayment } from "@/lib/billing";
import { developerOr, fail } from "@/lib/manager";

/** Deletes a payment typed by mistake. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  return (await deletePayment((await params).id)) ? NextResponse.json({ ok: true }) : fail("No such payment.", 404);
}
