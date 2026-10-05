import { env } from "@/lib/cf";

/**
 * Outbound email through Brevo (copied from Aqua's lib/mail.ts). MAIL_FROM is
 * a Brevo-verified sender, "Name <address>". Without the key it logs instead
 * and reports delivered: false; it never pretends to have sent.
 */
export async function sendMail(opts: { to: string; subject: string; text: string; replyTo?: string }) {
  const { BREVO_API_KEY: key, MAIL_FROM: from } = env();
  if (!key || !from) {
    console.log(`[mail] BREVO_API_KEY or MAIL_FROM not set, not sent.\n  to: ${opts.to}\n  ${opts.subject}\n  ${opts.text}`);
    return { delivered: false };
  }
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: m ? { name: m[1] || "tapndine", email: m[2] } : { name: "tapndine", email: from.trim() },
        to: [{ email: opts.to }],
        ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
        subject: opts.subject,
        textContent: opts.text,
      }),
    });
    if (!res.ok) console.error("[mail] Brevo rejected the send:", res.status, await res.text());
    return { delivered: res.ok };
  } catch (e) {
    console.error("[mail] send failed:", e);
    return { delivered: false };
  }
}
