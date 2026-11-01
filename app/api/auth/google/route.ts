import { NextResponse, type NextRequest } from "next/server";
import { BASE_PATH } from "@/lib/base";
import { env } from "@/lib/cf";
import { callbackUrl, STATE_COOKIE } from "@/lib/google";
import { randomId } from "@/lib/ids";

/** "Continue with Google": off to Google's account picker, with a state cookie to check on the way back. */
export async function GET(req: NextRequest) {
  const id = env().GOOGLE_CLIENT_ID;
  if (!id) return NextResponse.redirect(new URL(`${BASE_PATH}/start?error=google`, req.url), 303);
  const state = randomId();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: id,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    path: BASE_PATH || "/",
    maxAge: 10 * 60,
  });
  return res;
}
