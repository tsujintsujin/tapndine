"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/base";
import { SOURCE_COOKIE, SOURCE_MAX_AGE, sourceFromParams } from "@/lib/source-tags";

/** Remembers the utm tags of the link that first brought this browser here (first touch wins). */
export function SourceCookie() {
  useEffect(() => {
    if (document.cookie.split("; ").some((c) => c.startsWith(`${SOURCE_COOKIE}=`))) return;
    const src = sourceFromParams(new URLSearchParams(location.search));
    if (!src) return;
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SOURCE_COOKIE}=${src}; Path=${BASE_PATH || "/"}; Max-Age=${SOURCE_MAX_AGE}; SameSite=Lax${secure}`;
  }, []);
  return null;
}
