import { restaurantName } from "@/lib/dev";
import { currentLogin } from "@/lib/staff";
import { StaffInfoProvider } from "./ui";

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
