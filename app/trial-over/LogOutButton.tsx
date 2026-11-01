"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import { LogoutIcon } from "@/app/components/Icons";

export default function LogOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`${BASE_PATH}/api/staff/logout`, { method: "POST" }).catch(() => {});
        window.location.href = `${BASE_PATH}/login`;
      }}
      className="flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-chili hover:bg-chili/10 disabled:opacity-60"
    >
      <LogoutIcon width={20} height={20} />
      Log out
    </button>
  );
}
