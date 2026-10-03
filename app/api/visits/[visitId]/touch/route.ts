import { NextResponse } from "next/server";
import { liveVisit } from "@/lib/visits";

/** The menu asks this whether its link is still alive. */
export async function POST(_req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const visit = await liveVisit(visitId);
  return NextResponse.json(
    { alive: !!visit, expiresAt: visit?.expires_at ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
