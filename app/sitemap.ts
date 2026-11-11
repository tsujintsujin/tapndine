import type { MetadataRoute } from "next";

// The public pages. Menus, logins and staff screens stay out (they are noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://tappetite.click/", changeFrequency: "monthly", priority: 1 },
    { url: "https://tappetite.click/terms", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://tappetite.click/privacy", changeFrequency: "yearly", priority: 0.3 },
  ];
}
