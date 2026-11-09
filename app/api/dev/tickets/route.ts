import { NextResponse } from "next/server";
import { developerOr } from "@/lib/manager";
import { tickets } from "@/lib/support";

/** Every restaurant's conversation; every developer page polls this for its badges. */
export async function GET() {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  return NextResponse.json({ tickets: await tickets() }, { headers: { "Cache-Control": "no-store" } });
}
