import { NextResponse, type NextRequest } from "next/server";
import { parseName } from "@/lib/dev";
import { body, fail } from "@/lib/manager";
import { createTrial, saveTicketDetails, ticket } from "@/lib/signup";

/**
 * "Set up your restaurant". Body: { restaurant, name, buy? }; needs the
 * sign-up ticket cookie. Starts the free trial, or with `buy` keeps the names
 * on the ticket for the plans page (/start/plans), which makes the restaurant
 * once a plan is paid.
 */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const restaurant = parseName(b?.restaurant);
  const name = parseName(b?.name);
  if (!restaurant) return fail("Enter your restaurant's name (up to 60 characters).");
  if (!name) return fail("Enter your name.");
  const expired = () => fail("Your sign-up timed out. Start again with your email or Google.", 410);
  if (b?.buy === true) {
    const t = await ticket();
    if (!t) return expired();
    await saveTicketDetails(t.id, restaurant, name);
    return NextResponse.json({ ok: true });
  }
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  if ((await createTrial(restaurant, name, secure)) === "expired") return expired();
  return NextResponse.json({ ok: true });
}
