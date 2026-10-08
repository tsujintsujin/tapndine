import { NextResponse, type NextRequest } from "next/server";

/**
 * justin94.space reaches this Worker through the Portfolio's Vercel rewrite.
 * Vercel turns every client-side navigation (an RSC request) into a request
 * for `<path>.rsc` before proxying it, so `/admin/t/tbl_1` arrives as
 * `/admin/t/tbl_1.rsc` and the dynamic segment reads "tbl_1.rsc" → 404.
 * Strip the suffix so the route sees the real path. No real route ends in .rsc.
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = url.pathname.replace(/(\.prefetch)?(\.rsc)?$/, "");
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/:path*.rsc", "/:path*.prefetch"] };
