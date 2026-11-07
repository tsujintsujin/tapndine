import { NextResponse } from "next/server";
import { checkoutForIntent, settle } from "@/lib/checkout";

/**
 * PayMongo's payment.paid webhook: what grants a plan when the buyer closed
 * the QR screen before it saw the payment land. The PayMongo account also
 * serves TheJobStash, so intents that aren't ours are ignored.
 *
 * ponytail: no Paymongo-Signature check. The body only says which checkout to
 * look up; settle() then asks PayMongo's API directly whether it was paid, so
 * a forged call can only trigger an honest lookup. Verify the signature if
 * this ever starts trusting the body itself.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { data?: { attributes?: any } } | null;
  const event = body?.data?.attributes;
  if (event?.type !== "payment.paid") return NextResponse.json({ ok: true });

  const intentId = event?.data?.attributes?.payment_intent_id;
  if (typeof intentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(intentId)) return NextResponse.json({ ok: true });

  try {
    const id = await checkoutForIntent(intentId);
    if (id) await settle(id);
  } catch (e) {
    console.error(`[checkout] webhook settle ${intentId}:`, e);
    // Non-2xx makes PayMongo retry, which is what a failed lookup wants.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
