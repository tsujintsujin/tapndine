import { env } from "./cf";

// Dish photos go from the manager's browser straight to Cloudinary, so the
// Worker never carries the file. It only signs the upload: the secret stays
// here, and the signature only allows an upload into that restaurant's own
// folder: tapndine/<restaurant code>.

export const PHOTO_FOLDER = "tapndine";

export async function signUpload(slug: string) {
  const folder = `${PHOTO_FOLDER}/${slug}`;
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary's scheme: the sorted parameters, then the secret, SHA-1.
  const toSign = `folder=${folder}&timestamp=${timestamp}${e.CLOUDINARY_API_SECRET}`;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign));
  return {
    url: `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: e.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
  };
}

/**
 * Deletes every photo in the restaurant's folder, then the folder. Throws if
 * Cloudinary refuses, so the caller can say the photos are still there.
 * Photos uploaded before restaurants had their own folders are not touched.
 */
export async function deletePhotos(slug: string): Promise<void> {
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET) throw new Error("Cloudinary is not set up.");
  const base = `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}`;
  const headers = { Authorization: `Basic ${btoa(`${e.CLOUDINARY_API_KEY}:${e.CLOUDINARY_API_SECRET}`)}` };
  const folder = `${PHOTO_FOLDER}/${slug}`;
  // Up to 1000 photos per call; "partial" means there are more.
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${base}/resources/image/upload?prefix=${encodeURIComponent(folder + "/")}`, { method: "DELETE", headers });
    if (!res.ok) throw new Error(`Cloudinary: ${res.status}`);
    if (!((await res.json()) as { partial?: boolean }).partial) break;
  }
  const res = await fetch(`${base}/folders/${folder.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", headers });
  // 404: the restaurant never uploaded a photo, so there is no folder.
  if (!res.ok && res.status !== 404) throw new Error(`Cloudinary: ${res.status}`);
}
