import { NextResponse, type NextRequest } from "next/server";
import { BASE_PATH } from "@/lib/base";
import { env } from "@/lib/cf";
import { callbackUrl, STATE_COOKIE } from "@/lib/google";
import { verified } from "@/lib/signup";

type IdToken = { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: boolean; exp?: number };

/**
 * Back from Google with a one-time code. We swap it for the ID token straight
 * from Google over TLS, which Google's docs say needs no signature check, then
 * log in or start the sign-up like an emailed code does.
 */
export async function GET(req: NextRequest) {
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(BASE_PATH + path, req.url), 303);
    res.cookies.delete({ name: STATE_COOKIE, path: BASE_PATH || "/" });
    return res;
  };
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = env();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  // Cancelled on Google's screen, or a forged or stale return.
  if (!id || !secret || !code || !state || state !== req.cookies.get(STATE_COOKIE)?.value) return to("/start?error=google");

  let claims: IdToken;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: callbackUrl(req),
        grant_type: "authorization_code",
      }),
    });
    const token = (await res.json()) as { id_token?: string };
    if (!res.ok || !token.id_token) throw new Error(`token ${res.status}`);
    const part = token.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part), (c) => c.charCodeAt(0))));
  } catch (e) {
    console.error("[google] sign-in failed:", e);
    return to("/start?error=google");
  }
  const okIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!okIssuer || claims.aud !== id || !claims.sub || !claims.email || claims.email_verified !== true) {
    return to("/start?error=google");
  }

  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const next = await verified(claims.email.toLowerCase(), claims.sub, secure);
  if (next === "off") return to("/start?error=off");
  return to(next === "in" ? "/admin/dashboard" : "/start");
}
