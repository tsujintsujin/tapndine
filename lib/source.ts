import { cookies } from "next/headers";
import { SAFE_SOURCE, SOURCE_COOKIE } from "./source-tags";

/** This browser's saved sign-up source ("facebook/social/album1"), if any. Server only. */
export async function signupSource(): Promise<string | null> {
  const v = (await cookies()).get(SOURCE_COOKIE)?.value;
  return v && SAFE_SOURCE.test(v) ? v : null;
}
