import type { Metadata } from "next";
import { BASE_PATH } from "@/lib/base";

// Staff pages can be installed to the phone's home screen; the app opens on
// the login (which forwards a signed-in user to their own start page).
// Only here, so customers on the menu are never offered the staff app.
export const metadata: Metadata = {
  manifest: `${BASE_PATH}/staff.webmanifest`,
  appleWebApp: { capable: true, title: "tapndine", statusBarStyle: "default" },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
