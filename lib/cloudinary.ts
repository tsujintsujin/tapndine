import { env } from "./cf";

// Dish photos go from the manager's browser straight to Cloudinary, so the
// Worker never carries the file. It only signs the upload: the secret stays
// here, and the signature only allows an upload into the tapndine folder.

export const PHOTO_FOLDER = "tapndine";

export async function signUpload() {
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary's scheme: the sorted parameters, then the secret, SHA-1.
  const toSign = `folder=${PHOTO_FOLDER}&timestamp=${timestamp}${e.CLOUDINARY_API_SECRET}`;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign));
  return {
    url: `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: e.CLOUDINARY_API_KEY,
    timestamp,
    folder: PHOTO_FOLDER,
    signature: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
  };
}
