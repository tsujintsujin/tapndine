import { NextResponse, type NextRequest } from "next/server";
import { parseName } from "@/lib/dev";
import { body, fail } from "@/lib/manager";
import { createTrial } from "@/lib/signup";

/** Names the new restaurant and starts its free trial. Body: { restaurant, name }; needs the sign-up ticket cookie. */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const restaurant = parseName(b?.restaurant);
  const name = parseName(b?.name);
  if (!restaurant) return fail("Enter your restaurant's name (up to 60 characters).");
  if (!name) return fail("Enter your name.");
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  if ((await createTrial(restaurant, name, secure)) === "expired") {
    return fail("Your sign-up timed out. Start again with your email or Google.", 410);
  }
  return NextResponse.json({ ok: true });
}
