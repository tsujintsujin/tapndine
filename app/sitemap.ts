import type { MetadataRoute } from "next";

// The public pages. Menus, logins and staff screens stay out (they are noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://tapndine.online/", changeFrequency: "monthly", priority: 1 },
    { url: "https://tapndine.online/terms", changeFrequency: "yearly", priority: 0.3 },
  ];
}
