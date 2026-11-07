import { NextResponse, type NextRequest } from "next/server";
import { CHECKOUT_ID, settle } from "@/lib/checkout";
import { db } from "@/lib/cf";
import { dropTicket, ticket } from "@/lib/signup";
import { currentLogin, startSession } from "@/lib/staff";

/**
 * Has this payment gone through? The QR screen polls this. Each call asks
 * PayMongo and grants the plan the moment the intent succeeds, so the screen
 * needs nothing from the webhook. A new owner who paid is logged in here, on
 * the browser holding their sign-up ticket.
 *
 * Answers { status: "pending" | "paid", next? }: next is where to go once paid.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CHECKOUT_ID.test(id)) return NextResponse.json({ error: "No such payment." }, { status: 404 });

  // Only the buyer may ask: the restaurant's manager, or the browser with the sign-up ticket.
  const row = await db()
    .prepare("SELECT business_id, ticket FROM checkouts WHERE id = ?")
    .bind(id)
    .first<{ business_id: string; ticket: string | null }>();
  const [login, t] = await Promise.all([currentLogin(), ticket()]);
  const mine = !!row && ((!!login && login.business_id === row.business_id) || (!!t && t.id === row.ticket));
  if (!mine) return NextResponse.json({ error: "No such payment." }, { status: 404 });

  let status: "pending" | "paid" = "pending";
  let next: string | undefined;
  try {
    const s = await settle(id);
    if (s.status === "paid") {
      status = "paid";
      next = "/admin/dashboard";
      if (t && s.row?.ticket === t.id && s.row.staff_id) {
        const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
        await dropTicket(t.id);
        await startSession(s.row.staff_id, secure);
        next = "/admin/menu";
      }
    }
  } catch (e) {
    // A failed lookup is a "not yet", not an error to show: the next poll asks again.
    console.error(`[checkout] poll settle ${id}:`, e);
  }
  return NextResponse.json({ status, next }, { headers: { "Cache-Control": "no-store" } });
}
