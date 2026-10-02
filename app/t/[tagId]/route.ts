import { NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/base";
import { startVisit } from "@/lib/visits";

/**
 * The URL written on the NFC tag. Every tap opens a fresh visit and sends the
 * phone to its random menu URL; the tag URL itself never shows a menu.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ tagId: string }> }) {
  const { tagId } = await params;
  const visitId = await startVisit(tagId.toLowerCase());
  // A relative Location keeps the phone on whatever host it used to reach us
  // (next dev rewrites req.url to "localhost", which a phone on Wi-Fi cannot open).
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: BASE_PATH + (visitId ? `/m/${visitId}` : "/unknown-tag") },
  });
  // A cached redirect would hand every tap the same visit.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
