import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/app/components/LegalPage";

// What tapndine stores about guests, restaurant staff and demo requests, and why.
// Keep it matching the code: lib/visits.ts (2-hour links), app/t/[tagId] (tnd_phone
// cookie), lib/staff.ts (login cookie), lib/signup.ts (trial sign-up), app/api/demo (demo requests), lib/cloudinary.ts.

export const metadata: Metadata = {
  title: "Privacy Policy · tapndine",
  description:
    "What tapndine stores about guests, restaurant staff and demo requests, why, for how long, and your rights under the Philippine Data Privacy Act.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "November 2, 2026";
const EMAIL = "justin.masiga.94@gmail.com";

const SECTIONS: LegalSection[] = [
  {
    title: "Who we are",
    body: (
      <>
        <p>
          tapndine is run by TSUJIN IT SOLUTIONS in the Philippines (&quot;we&quot;, &quot;us&quot;). This policy explains
          what personal information tapndine collects, why, and what you can ask us to do with it. We follow the Data
          Privacy Act of 2012 (Republic Act No. 10173).
        </p>
        <p>
          When a guest orders at a restaurant, that restaurant decides why the order is collected; we store and process it
          for them. For our own customers (restaurants) and people who book a demo, we decide.
        </p>
      </>
    ),
  },
  {
    title: "Guests at a restaurant",
    body: (
      <>
        <p>Guests do not make an account. When a guest taps the tag on a table and orders, we store:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>the name the guest types, so the waiter knows whose order is whose;</li>
          <li>what they ordered, the table, and the time;</li>
          <li>
            a random number kept in a cookie on their phone, so that tapping the tag again from the same phone opens the
            same order instead of a new one.
          </li>
        </ul>
        <p>
          We do not ask guests for a phone number, email or payment details, and we never take payment from guests. The
          link on the guest&apos;s phone stops working 2 hours after it opens.
        </p>
      </>
    ),
  },
  {
    title: "Restaurants and their staff",
    body: (
      <>
        <p>For each restaurant using tapndine, we store:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>the names and usernames of its manager and waiters, and their passwords in scrambled (hashed) form only;</li>
          <li>its menu, prices and dish photos;</li>
          <li>its orders and the statistics made from them;</li>
          <li>its plan, contract and payment records.</li>
        </ul>
        <p>Staff who log in get a cookie that keeps them logged in. It is needed for tapndine to work and does nothing else.</p>
      </>
    ),
  },
  {
    title: "Restaurants that sign up for the free trial",
    body: (
      <>
        <p>
          When you sign up, or sign back in, without a password, we store your email address, your name and your
          restaurant&apos;s name. If you use a code, we email it to you through Brevo and keep only a scrambled copy until it
          is used or expires.
        </p>
        <p>
          If you continue with Google, Google tells us your email address and a number that identifies your Google account.
          We use them only to log you in to tapndine. We don&apos;t ask Google for your name or photo, we can&apos;t see your
          Google password, and we don&apos;t read anything else in your Google account or share what Google sends us.
        </p>
      </>
    ),
  },
  {
    title: "People who book a demo",
    body: (
      <p>
        When you book a demo, we store the name, email, message and time you give us, and send them to our own inbox so we
        can reply. We use them only to arrange and run the demo.
      </p>
    ),
  },
  {
    title: "How we use it",
    body: (
      <>
        <p>
          Only to run tapndine: to show the menu, pass orders to the waiters, show the restaurant its statistics, keep
          logins secure, sign restaurants up for the free trial, and answer demo requests.
        </p>
        <p>We do not sell personal information, use it for advertising, or share it with other restaurants.</p>
      </>
    ),
  },
  {
    title: "Who else handles it",
    body: (
      <>
        <p>We use a few service providers to run tapndine:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Cloudflare, which hosts the website and its database and counts visits without cookies;</li>
          <li>Cloudinary, which stores and serves dish photos;</li>
          <li>Brevo, which sends our emails;</li>
          <li>Google, if you choose to continue with Google, which confirms who you are.</li>
        </ul>
        <p>
          They may store data outside the Philippines. They handle it only to provide their service to us. We may also
          share information when the law requires it.
        </p>
      </>
    ),
  },
  {
    title: "How long we keep it",
    body: (
      <p>
        Orders, including the names guests typed, stay in the restaurant&apos;s order history for as long as the
        restaurant uses tapndine, because its statistics are built from them. When a restaurant stops using tapndine, we
        delete its data within 30 days of being asked, or keep it only as long as the law requires. A free trial&apos;s data
        stays after the trial ends, so the restaurant can pick up where it left off, until it asks us to delete it. Demo
        requests are deleted once they are no longer needed.
      </p>
    ),
  },
  {
    title: "Keeping it safe",
    body: (
      <p>
        Everything is sent over an encrypted (https) connection. Passwords are stored hashed, logins lock after repeated
        wrong passwords, and each restaurant can only see its own data. No system is perfectly secure; if a breach ever
        affects your information, we will tell you and the National Privacy Commission as the law requires.
      </p>
    ),
  },
  {
    title: "Your rights",
    body: (
      <>
        <p>
          Under the Data Privacy Act you can ask to see the personal information we hold about you, have it corrected or
          deleted, or object to how it is used. You can also complain to the National Privacy Commission.
        </p>
        <p>
          Guests can ask the restaurant they ordered at, or email us directly and we will help. Please tell us the
          restaurant, the table and roughly when you ordered, so we can find it.
        </p>
      </>
    ),
  },
  {
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we will update the date at the top. If the change is important, we will tell the
        restaurants using tapndine before it takes effect. See also our{" "}
        <Link href="/terms" className="font-semibold underline">Terms of Service</Link>.
      </p>
    ),
  },
  {
    title: "Contact",
    body: (
      <p>
        Questions or requests about your information? Email us at{" "}
        <a href={`mailto:${EMAIL}`} className="font-semibold underline break-all">{EMAIL}</a>.
      </p>
    ),
  },
];

export default function Privacy() {
  return <LegalPage title="Privacy Policy" updated={UPDATED} sections={SECTIONS} />;
}
