import { NextResponse } from "next/server";
import { createCheckout, recentUnpaid } from "@/lib/checkout";
import { db } from "@/lib/cf";
import { parseName } from "@/lib/dev";
import { body, fail } from "@/lib/manager";
import { planByName } from "@/lib/plans";
import { ownerByEmail, ticket } from "@/lib/signup";
import { currentLogin } from "@/lib/staff";
import { ON_TRIAL } from "@/lib/trial";

/**
 * A QR Ph code for buying a plan. Body: { plan }, plus { restaurant, name } for
 * a new owner. Two buyers: a manager of a restaurant on its free trial (ended
 * or not), or someone with a sign-up ticket who picked "Buy a plan".
 *
 * Nothing is granted here. Only settle() grants the plan (and makes a new
 * owner's restaurant), once PayMongo itself says the money arrived.
 */
export async function POST(req: Request) {
  const b = await body(req);
  const plan = planByName(b?.plan);
  if (!plan) return fail("Pick a plan.");

  const tooMany = () =>
    fail("Too many unpaid codes in a row. Use the one you have, or try again in a few minutes.", 429);
  const make = async (buyer: Parameters<typeof createCheckout>[1]) => {
    try {
      return NextResponse.json(await createCheckout(plan, buyer));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Couldn't make a payment code.", 502);
    }
  };

  const login = await currentLogin();
  if (login) {
    if (login.role === "waiter" || login.role === "developer" || !login.business_id) {
      return fail("Only the restaurant's manager can buy its plan.", 403);
    }
    const trial = await db()
      .prepare(`SELECT 1 FROM businesses b WHERE b.id = ? AND ${ON_TRIAL}`)
      .bind(login.business_id)
      .first();
    // ponytail: buying covers a restaurant on its free trial only; renewing a plan is still done in Billing.
    if (!trial) return fail("Your restaurant already has a plan. Message tapndine to renew or change it.", 409);
    if ((await recentUnpaid(login.business_id)) >= 5) return tooMany();
    return make({ businessId: login.business_id });
  }

  const t = await ticket();
  if (!t) return fail("Your sign-up timed out. Start again with your email or Google.", 410);
  const restaurant = parseName(b?.restaurant);
  const name = parseName(b?.name);
  if (!restaurant) return fail("Enter your restaurant's name (up to 60 characters).");
  if (!name) return fail("Enter your name.");
  if (await ownerByEmail(t.email)) return fail("There's already an account with this email. Log in instead.", 409);
  const open = await db()
    .prepare("SELECT COUNT(*) AS n FROM checkouts WHERE ticket = ? AND status = 'pending' AND created_at > ?")
    .bind(t.id, Date.now() - 10 * 60 * 1000)
    .first<{ n: number }>();
  if ((open?.n ?? 0) >= 5) return tooMany();
  return make({
    owner: { email: t.email, googleSub: t.google_sub, passwordHash: t.password_hash, restaurant, name },
    ticket: t.id,
  });
}
