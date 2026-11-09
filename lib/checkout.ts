import { today } from "./billing";
import { db, env } from "./cf";
import { randomId } from "./ids";
import { addDays, BONUS_DAYS, chargeCents, termEnds, type Plan, type Term } from "./plans";
import { emailTaken, ownerByEmail, restaurantStatements, slugAttempt, slugFor } from "./signup";

/**
 * Buying a plan with QR Ph through PayMongo's Payment Intent API, copied from
 * TheJobStash (web/lib/paymongo.ts): our own QR on screen, the browser polls.
 *
 * A plan is bought for a year (plus BONUS_DAYS) or a month, and bought again
 * for each new one: it starts the day after the restaurant's last paid day.
 *
 * Two buyers. A restaurant buys for itself (on its trial or renewing). A new owner who
 * picked "Buy a plan" at sign-up has no account yet: what they typed waits on
 * the checkout, and their restaurant and login are made only once it is paid.
 *
 * Nothing trusts the browser or the webhook body. Both only say "go and look
 * at checkout X"; settle() asks PayMongo with the secret key whether that
 * intent succeeded and for how much.
 */
const API = "https://api.paymongo.com/v1";

export const CHECKOUT_ID = /^chk_[A-Za-z0-9_-]{22}$/;

/** What a new owner typed at sign-up, kept on their checkout until it is paid. */
export type Owner = { email: string; googleSub: string | null; passwordHash: string | null; restaurant: string; name: string };

async function pm(path: string, init: RequestInit = {}) {
  const key = env().PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("Payments aren't set up on this server yet.");
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: "Basic " + btoa(key + ":"),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  const j = (await res.json().catch(() => ({}))) as { data?: any; errors?: { detail?: string }[] };
  if (!res.ok) {
    const detail = j?.errors?.[0]?.detail || `HTTP ${res.status}`;
    console.error(`[paymongo] ${path}: ${detail}`);
    throw new Error(`PayMongo refused the request: ${detail}`);
  }
  return j.data;
}

const post = (path: string, attributes: Record<string, unknown>) =>
  pm(path, { method: "POST", body: JSON.stringify({ data: { attributes } }) });

/** Unpaid codes made for one restaurant in the last 10 minutes. Five is well past anyone actually buying. */
export async function recentUnpaid(businessId: string) {
  const r = await db()
    .prepare("SELECT COUNT(*) AS n FROM checkouts WHERE business_id = ? AND status = 'pending' AND created_at > ?")
    .bind(businessId, Date.now() - 10 * 60 * 1000)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/**
 * A QR Ph code for `plan` for one `term`. `businessId`: a restaurant buying for itself.
 * `owner` + `ticket`: a new owner; their restaurant gets made under ids picked now.
 * The code expires after PayMongo's default 30 minutes.
 */
export async function createCheckout(
  plan: Plan,
  term: Term,
  buyer: { businessId: string } | { owner: Owner; ticket: string }
): Promise<{ id: string; qr: string; expiresAt: number }> {
  const id = "chk_" + randomId();
  const amount = chargeCents(plan, term);
  const isNew = "owner" in buyer;
  const businessId = isNew ? "biz_" + randomId() : buyer.businessId;

  // The row goes in before PayMongo is called, and the intent id is on it
  // before any QR exists, so a code that gets paid always has a row to settle.
  await db()
    .prepare(
      `INSERT INTO checkouts (id, business_id, staff_id, owner, ticket, plan, tables, term, amount_cents, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(
      id,
      businessId,
      isNew ? randomId() : null,
      isNew ? JSON.stringify(buyer.owner) : null,
      isNew ? buyer.ticket : null,
      plan.name,
      plan.tables,
      term,
      amount,
      Date.now()
    )
    .run();

  const intent = await post("/payment_intents", {
    amount,
    currency: "PHP",
    payment_method_allowed: ["qrph"],
    description: `tapndine ${plan.name} plan, 1 ${term}`,
    metadata: { checkout_id: id, business_id: businessId, plan: plan.name, term },
  });
  await db().prepare("UPDATE checkouts SET intent_id = ? WHERE id = ?").bind(intent.id, id).run();

  const method = await post("/payment_methods", { type: "qrph" });
  const attached = await post(`/payment_intents/${intent.id}/attach`, {
    payment_method: method.id,
    client_key: intent.attributes.client_key,
  });

  // The image goes straight into an <img src> and a download link, so it must
  // be an image data URI and nothing else: never a URL or a javascript: link.
  const code = attached?.attributes?.next_action?.code;
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(code?.image_url || "")) {
    throw new Error("PayMongo didn't send back a QR code.");
  }
  const expires = Date.parse(code.expires_at);
  return { id, qr: code.image_url as string, expiresAt: Number.isFinite(expires) ? expires : Date.now() + 30 * 60 * 1000 };
}

/** The checkout for a PayMongo intent id, for the webhook. */
export async function checkoutForIntent(intentId: string) {
  const row = await db().prepare("SELECT id FROM checkouts WHERE intent_id = ?").bind(intentId).first<{ id: string }>();
  return row?.id ?? null;
}

type Row = {
  id: string;
  business_id: string;
  staff_id: string | null;
  owner: string | null;
  ticket: string | null;
  plan: string;
  tables: number;
  term: Term;
  amount_cents: number;
  intent_id: string | null;
  status: string;
};

export type Settled = { status: "paid" | "pending" | "unknown"; row?: Row };

/**
 * Grant a checkout's plan if PayMongo says its intent succeeded in full: a
 * term (a year plus BONUS_DAYS, or a month), as a contract with this payment on it, and for a new
 * owner their restaurant and login first. Safe to call any number of times,
 * from the polling and the webhook at once: every statement runs only while
 * the checkout is still pending, and the same batch marks it paid.
 */
export async function settle(id: string): Promise<Settled> {
  const load = () => db().prepare("SELECT * FROM checkouts WHERE id = ?").bind(id).first<Row>();
  const row = await load();
  if (!row?.intent_id) return { status: "unknown" };
  if (row.status === "paid") return { status: "paid", row };

  const intent = await pm(`/payment_intents/${row.intent_id}`);
  const paid = intent?.attributes?.status === "succeeded" && intent?.attributes?.amount === row.amount_cents;
  if (!paid) return { status: "pending", row };
  const paymentRef: string = intent?.attributes?.payments?.[0]?.id || row.intent_id;

  const d = db();
  const pending = { sql: "EXISTS (SELECT 1 FROM checkouts WHERE id = ? AND status = 'pending')", binds: [id] as unknown[] };
  const guarded = (sql: string, vals: unknown[]) => d.prepare(`${sql} WHERE ${pending.sql}`).bind(...vals, ...pending.binds);

  // A bought term starts today, or the day after the last paid day of a plan it already has.
  const last = await d
    .prepare("SELECT MAX(ends_on) AS ends FROM contracts WHERE business_id = ?")
    .bind(row.business_id)
    .first<{ ends: string | null }>();
  const now = Date.now();
  const signed = today(now);
  const starts = last?.ends && last.ends >= signed ? addDays(last.ends, 1) : signed;
  const ends = termEnds(starts, row.term);
  const contractId = randomId();
  const plan = [
    guarded(
      `INSERT INTO contracts (id, business_id, plan, tables, price_cents, signed_on, starts_on, ends_on, note, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`,
      [contractId, row.business_id, row.plan, row.tables, row.amount_cents, signed, starts, ends, row.term === "year" ? `Bought on the site, 1 year + ${BONUS_DAYS} days` : "Bought on the site, 1 month", now]
    ),
    guarded(
      `INSERT INTO payments (id, contract_id, paid_on, amount_cents, method, reference, note, created_at)
       SELECT ?, ?, ?, ?, 'QR Ph', ?, ?, ?`,
      [randomId(), contractId, signed, row.amount_cents, paymentRef, `PayMongo ${row.intent_id}`, now]
    ),
    d.prepare("UPDATE checkouts SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'").bind(now, id),
  ];

  if (!row.owner || !row.staff_id) {
    await d.batch(plan);
    return { status: "paid", row: (await load()) ?? row };
  }

  const owner = JSON.parse(row.owner) as Owner;
  const base = slugFor(owner.restaurant);
  for (let attempt = 0; attempt < 4; attempt++) {
    const made = restaurantStatements(
      {
        businessId: row.business_id,
        staffId: row.staff_id,
        slug: slugAttempt(base, attempt),
        restaurant: owner.restaurant,
        name: owner.name,
        email: owner.email,
        googleSub: owner.googleSub,
        passwordHash: owner.passwordHash,
        trialEndsAt: null,
        firstTable: row.tables > 0,
      },
      pending
    );
    try {
      await d.batch([...made, ...plan]);
      return { status: "paid", row: (await load()) ?? row };
    } catch (e) {
      if (!emailTaken(e)) continue; // the code or username was taken: try the next ending
      // The email got an account while the code was open (a trial in another
      // tab). The money still buys the plan: for that account's restaurant.
      const acct = await ownerByEmail(owner.email);
      const biz = acct
        ? await d.prepare("SELECT business_id FROM staff WHERE id = ?").bind(acct.id).first<{ business_id: string }>()
        : null;
      if (!acct || !biz) throw e;
      await d
        .prepare("UPDATE checkouts SET business_id = ?, staff_id = ?, owner = NULL WHERE id = ? AND status = 'pending'")
        .bind(biz.business_id, acct.id, id)
        .run();
      return settle(id);
    }
  }
  throw new Error(`Couldn't find a free restaurant code for checkout ${id}.`);
}
