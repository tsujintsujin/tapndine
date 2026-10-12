import { NextResponse } from "next/server";
import { signUpload } from "@/lib/cloudinary";
import { restaurantSlug } from "@/lib/dev";
import { fail, managerOr } from "@/lib/manager";

/** A one-off signature for uploading a dish photo straight to Cloudinary, into this restaurant's folder. */
export async function POST() {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const slug = await restaurantSlug(me.business_id);
  if (!slug) return fail("No such restaurant.", 404);
  const signed = await signUpload(slug);
  if (!signed) return fail("Photo uploads aren't set up on this server.", 503);
  return NextResponse.json(signed);
}
