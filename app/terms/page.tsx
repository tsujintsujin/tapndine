import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/app/components/LegalPage";

// The Terms of Service, for restaurants that buy tappetite. Plain language on purpose.

export const metadata: Metadata = {
  title: "Terms of Service · tappetite",
  description: "The terms for restaurants using tappetite: plans, payment, renewal, table QR codes and NFC tags, your data and your guests.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "October 25, 2026";
const EMAIL = "justin.masiga.94@gmail.com";

const SECTIONS: LegalSection[] = [
  {
    title: "Who we are",
    body: (
      <>
        <p>
          tappetite is made and run by TSUJIN IT SOLUTIONS, in the Philippines (&quot;we&quot;, &quot;us&quot;). These
          terms are between us and the restaurant, cafe or business that signs up for tappetite (&quot;you&quot;).
        </p>
        <p>
          By paying for a plan or using tappetite, you agree to these terms. If you sign up on behalf of a business, you
          confirm you are allowed to agree for it.
        </p>
      </>
    ),
  },
  {
    title: "What tappetite is",
    body: (
      <p>
        Each of your tables gets its own QR code, and restaurants in Davao City, Davao del Sur, Davao del Norte and
        Davao de Oro also get an NFC tag for each table. A guest scans the code or taps the tag with their phone, your
        menu opens in their browser, and the orders they send go to your waiters&apos; phones. Managers also get sales and busy-hour
        statistics. Guests do not install an app or make an account.
      </p>
    ),
  },
  {
    title: "Plans, payment and renewal",
    body: (
      <>
        <p>
          Each plan covers a set number of tables for one year. The current plans and prices are on our{" "}
          <Link href="/#pricing" className="font-semibold underline">pricing section</Link>. Prices are in Philippine pesos.
        </p>
        <p>
          You pay for the year in advance, by GCash, Maya, bank transfer or cash. Your year starts on the day your menu
          goes live.
        </p>
        <p>
          Before your year ends, we will remind you to renew. If you renew on time, you keep the same price for the next
          year. If you do not renew, your menu and staff logins stop working when the year ends. You can come back later
          at the prices of that time.
        </p>
        <p>Need more tables? You can move up to a bigger plan at any time and pay the difference for the rest of your year.</p>
      </>
    ),
  },
  {
    title: "Refunds",
    body: (
      <p>
        Before your menu goes live, you can cancel and get your payment back in full. Once your menu is live, payments
        are not refunded, including for the unused part of a year.
      </p>
    ),
  },
  {
    title: "NFC tags",
    body: (
      <p>
        Restaurants in Davao City, Davao del Sur, Davao del Norte and Davao de Oro get one NFC tag per table, free,
        with a paid plan; everywhere else, guests scan the table&apos;s QR code. If a tag stops working because it is
        faulty, we replace it for free.
        Tags that are lost, broken or taken by a guest can be replaced for a small fee. Please keep the tags where
        guests can tap them and away from metal surfaces, which can block them.
      </p>
    ),
  },
  {
    title: "Your logins",
    body: (
      <p>
        You get logins for your manager and waiters. Keep the passwords private, and tell us right away if you think one
        has been shared or stolen. You are responsible for what is done with your logins.
      </p>
    ),
  },
  {
    title: "Your menu and your data",
    body: (
      <>
        <p>
          Your menu, dish photos, prices and order history belong to you. You give us permission to store and show them
          only so tappetite can work for you. You confirm you have the right to use the photos and text you give us.
        </p>
        <p>
          You are responsible for your menu being accurate, including prices, availability and any allergy information.
          If you stop using tappetite, you can ask us for a copy of your order history within 30 days, after which we may
          delete it.
        </p>
      </>
    ),
  },
  {
    title: "Your guests",
    body: (
      <>
        <p>
          Guests do not make accounts. When they order, they type a name so your waiter knows whose order is whose. We
          store that name and their orders for you, to show them to your staff and in your statistics. We do not sell it
          or use it to advertise.
        </p>
        <p>
          The menu link on a guest&apos;s phone stops working after 2 hours, so it can&apos;t be used to order from
          outside the restaurant. We handle guest information in line with the Philippine Data Privacy Act of 2012
          (Republic Act No. 10173), as our{" "}
          <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link> explains.
        </p>
        <p>
          Your guests&apos; meals, payments and service are between you and them. tappetite passes orders to your staff;
          it does not take payment from guests.
        </p>
      </>
    ),
  },
  {
    title: "Fair use",
    body: (
      <p>
        Do not use tappetite for anything illegal, to sell things you are not allowed to sell, or to try to get into
        another restaurant&apos;s data or break the service. We may suspend an account that does, and will tell you why.
      </p>
    ),
  },
  {
    title: "Keeping it running",
    body: (
      <>
        <p>
          We work to keep tappetite online every day, and fix problems as quickly as we can. We can&apos;t promise it will
          never go down: phones, internet connections and the services we run on can fail. Keep a way to take orders by
          hand for those moments.
        </p>
        <p>
          We improve tappetite over time and may change how parts of it look or work. We will not take away a main
          feature you paid for during your year.
        </p>
      </>
    ),
  },
  {
    title: "Limits of our responsibility",
    body: (
      <p>
        As far as the law allows, we are not responsible for lost sales, lost profit or other indirect losses caused by
        tappetite being unavailable or by a mistake in an order. Our total responsibility to you for any claim is limited
        to what you paid us for the current year.
      </p>
    ),
  },
  {
    title: "Ending the service",
    body: (
      <p>
        You can stop using tappetite at any time; see Refunds for what happens to your payment. We may end the service for
        a restaurant that breaks these terms, after telling you and giving you a chance to fix it where we can. If we
        ever stop running tappetite altogether, we will tell you at least 30 days before and refund the unused part of your
        year.
      </p>
    ),
  },
  {
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. When we make an important change, we will tell you before it takes effect. The date
        at the top of this page shows when they last changed.
      </p>
    ),
  },
  {
    title: "Law",
    body: <p>These terms are governed by the laws of the Republic of the Philippines.</p>,
  },
  {
    title: "Contact",
    body: (
      <p>
        Questions about these terms? Email us at{" "}
        <a href={`mailto:${EMAIL}`} className="font-semibold underline break-all">{EMAIL}</a>.
      </p>
    ),
  },
];

export default function Terms() {
  return <LegalPage title="Terms of Service" updated={UPDATED} sections={SECTIONS} />;
}
