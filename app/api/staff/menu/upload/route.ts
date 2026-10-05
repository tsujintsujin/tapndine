import { NextResponse } from "next/server";
import { signUpload } from "@/lib/cloudinary";
import { fail, managerOr } from "@/lib/manager";

/** A one-off signature for uploading a dish photo straight to Cloudinary. */
export async function POST() {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const signed = await signUpload();
  if (!signed) return fail("Photo uploads aren't set up on this server.", 503);
  return NextResponse.json(signed);
}
