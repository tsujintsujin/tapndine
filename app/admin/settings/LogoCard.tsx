"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { btn, card } from "../kit";
import { api } from "../ui";

const MAX_PHOTO = 10 * 1024 * 1024; // Cloudinary's free-plan limit per image

/**
 * The top of the guests' menu as they see it: the restaurant's logo and name.
 * Upload goes straight to Cloudinary (same signed upload as dish photos),
 * then the URL is saved.
 */
export default function LogoCard({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (url: string | null) => {
    await api("/api/staff/logo", { method: "POST", body: { logoUrl: url } });
    router.refresh();
  };

  const upload = async (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) return setError("That file isn't an image. Use a JPG, PNG or WebP.");
    if (file.size > MAX_PHOTO) return setError("That image is over 10 MB. Use a smaller one.");
    setBusy(true);
    try {
      const s = await api<{ url: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        "/api/staff/menu/upload",
        { method: "POST", body: {} }
      );
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", s.apiKey);
      form.append("timestamp", String(s.timestamp));
      form.append("signature", s.signature);
      form.append("folder", s.folder);
      const r = await fetch(s.url, { method: "POST", body: form });
      const j = (await r.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
      if (!r.ok || !j.secure_url) throw new Error(j.error?.message ?? "The logo didn't upload. Try again.");
      // Small and square-ish is all the menu header needs.
      await save(j.secure_url.replace("/upload/", "/upload/f_auto,q_auto,c_limit,w_256,h_256/"));
    } catch (e) {
      setError(e instanceof TypeError ? "No connection. Check the internet and try again." : (e as Error).message);
    }
    setBusy(false);
  };

  const remove = async () => {
    setError("");
    setBusy(true);
    try {
      await save(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className={`${card} mt-6 flex flex-wrap items-center gap-4`} aria-labelledby="logo-title">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-paper ring-1 ring-line">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain" />
        ) : (
          <span className="font-display text-xl font-bold text-muted" aria-hidden>
            {name.slice(0, 1)}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 basis-[calc(100%-72px)] sm:basis-0">
        <h2 id="logo-title" className="font-display text-lg font-bold leading-tight">
          Logo on your menu
        </h2>
        <p className="text-[14px] text-muted">
          {logoUrl ? "Guests see it next to your name at the top of the menu." : "No logo yet: guests see your name only."}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-[14px] text-chili">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={btn.secondary}>
          {busy ? "Saving…" : logoUrl ? "Change logo" : "Upload logo"}
        </button>
        {logoUrl && (
          <button type="button" disabled={busy} onClick={remove} className={btn.danger}>
            Remove
          </button>
        )}
      </div>
    </section>
  );
}
