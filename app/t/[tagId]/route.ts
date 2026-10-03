import { NextResponse, type NextRequest } from "next/server";
import { BASE_PATH } from "@/lib/base";
import { randomId } from "@/lib/ids";
import { isPhoneId, startVisit } from "@/lib/visits";

const PHONE_COOKIE = "tnd_phone";

/**
 * The URL written on the NFC tag. Every tap sends the phone to its menu URL;
 * the tag URL itself never shows a menu. The phone keeps a random id in a
 * cookie, so a re-tap from the same phone gets its own link back.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  const { tagId } = await params;
  const known = req.cookies.get(PHONE_COOKIE)?.value;
  const phoneId = known && isPhoneId(known) ? known : randomId();
  const visitId = await startVisit(tagId.toLowerCase(), phoneId);
  // A relative Location keeps the phone on whatever host it used to reach us
  // (next dev rewrites req.url to "localhost", which a phone on Wi-Fi cannot open).
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: BASE_PATH + (visitId ? `/m/${visitId}` : "/unknown-tag") },
  });
  // A cached redirect would hand every tap the same visit.
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(PHONE_COOKIE, phoneId, {
    httpOnly: true,
    sameSite: "lax",
    // Secure only over https: a phone testing against next dev on Wi-Fi is on http.
    secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    path: BASE_PATH || "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
