import { NextResponse, type NextRequest } from "next/server";

/** Where tapndine lives now. */
const HOME = "https://tapndine.online";

/**
 * tapndine used to live at justin94.space/tapndine, and NFC tags already
 * written carry those links. The Portfolio still proxies that path here, so an
 * old link arrives as /tapndine/<path>: send it to the same page on
 * tapndine.online. On this PC (localhost or a LAN address) it stays local.
 */
export function middleware(req: NextRequest) {
  const { hostname, pathname, search, origin } = req.nextUrl;
  const local = hostname === "localhost" || /^[\d.]+$/.test(hostname);
  const path = pathname.replace(/^\/tapndine/, "") || "/";
  return NextResponse.redirect(`${local ? origin : HOME}${path}${search}`, 308);
}

export const config = { matcher: ["/tapndine", "/tapndine/:path*"] };
