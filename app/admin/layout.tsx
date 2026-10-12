import type { Metadata } from "next";
import { BASE_PATH } from "@/lib/base";
import { restaurantName } from "@/lib/dev";
import { currentLogin } from "@/lib/staff";
import { StaffInfoProvider } from "./ui";

// Staff pages can be installed to the phone's home screen; the app opens on
// the login (which forwards a signed-in user to their own start page).
// Only here, so customers on the menu are never offered the staff app.
export const metadata: Metadata = {
  manifest: `${BASE_PATH}/staff.webmanifest`,
  appleWebApp: { capable: true, title: "tapndine", statusBarStyle: "default" },
};

/** Every staff screen knows whose restaurant it shows, and whether a developer is looking. */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const login = await currentLogin();
  const id = login?.business_id ?? null;
  const name = id ? await restaurantName(id) : null;
  return (
    <StaffInfoProvider value={{ developer: login?.role === "developer", restaurant: id && name ? { id, name } : null }}>
      {children}
    </StaffInfoProvider>
  );
}
