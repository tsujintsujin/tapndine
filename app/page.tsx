import type { Metadata } from "next";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { BASE_PATH } from "@/lib/base";
import HomePlans from "./HomePlans";
import { EXTRA_TABLE, METHODS, PLANS } from "@/lib/plans";
import { CheckIcon } from "@/app/components/Icons";
import { Wordmark } from "@/app/components/Wordmark";
import { SiteFooter } from "@/app/components/SiteFooter";
import QRCode from "qrcode";
import { BookDemoButton } from "./BookDemo";
import { Bowl, Chili, Cutlery, Drink, Fish, Leaf, Shrimp } from "./Doodles";
import { DEMO_TAG } from "@/lib/visits";

// The tappetite homepage, for restaurant owners: tappetite ends the idle waiting
// at the table (for the menu, for a waiter, for answers about a dish). The plan
// is REMODEL.md. The phone screens in "How it works" are real captures of a test
// run at the sample restaurant (public/landing/); the round "plates" are doodles
// (Doodles.tsx). The moving pictures (hero, the two tables, menu, waiter) are
// HyperFrames compositions in the stock flat art: source in videos/, served from
// public/anim/ (see Anim below).

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

// Search terms this page is written for. Main: "online menu" (Justin, 2026-11-11).
// Also: table ordering, QR code menu, digital menu, restaurants and cafes.
// "Online menu" leads the title, the description, the H1 line, the intro and the
// first FAQ answer; keep it there when rewording any of them. No country in this
// copy: tappetite is meant to go global (Justin, 2026-11-11).
// The home-screen icon keeps the brand alone (appleWebApp).
const TITLE = "Online menu & table ordering for restaurants · tappetite";
const DESCRIPTION =
  `Online menu and table ordering for restaurants and cafes. Guests scan or tap, see every dish and order from their phone. From ₱${PLANS[0].price.toLocaleString("en-PH")} a year.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: "tappetite", title: TITLE, description: DESCRIPTION, locale: "en_PH" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  appleWebApp: { title: "tappetite" },
};

const CONTACT = "mailto:justin.masiga.94@gmail.com?subject=tappetite%20for%20my%20restaurant";
const shot = (name: string) => `${BASE_PATH}/landing/${name}.webp`;
// Bump when the stats loop is re-rendered: browsers keep cached video by URL.
const STATS_V = "3";
/** Bump when the four phone captures (public/landing/m-*, s-table) are re-shot: cached a week. */
const STEPS_V = "2";
/** Bump when a homepage animation changes: browsers keep play.html for a week (public/_headers). */
const ANIM_V = "4";

/** Where restaurants get NFC tags for their tables free (Justin, 2026-10-25). */
const NFC_AREA = "Davao City, Davao del Sur, Davao del Norte and Davao de Oro";
const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
/** A plan's yearly price per table per month: ₱5,000 for 10 tables is ₱41.67. */

/**
 * The demo restaurant's "Menu for show" link: the real guest menu, to look
 * through, with no waiter to send to.
 */
const DEMO_PATH = `/t/${DEMO_TAG}`;
const DEMO_URL = `https://tappetite.click${DEMO_PATH}`;

const BLOB =
  "M44.7,-58.3C57.1,-48.7,65.8,-34.4,70.1,-18.6C74.3,-2.7,74.1,14.7,67,29.1C59.9,43.5,45.9,54.8,30.3,62.3C14.7,69.8,-2.6,73.5,-19.6,70.2C-36.6,66.9,-53.3,56.6,-63.6,41.7C-73.9,26.8,-77.8,7.3,-73.6,-9.9C-69.4,-27.1,-57.1,-42,-42.4,-51.3C-27.7,-60.6,-10.6,-64.3,3.6,-68.6C17.8,-72.9,32.3,-67.9,44.7,-58.3Z";

function Blob({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={`pointer-events-none absolute ${className}`} aria-hidden="true">
      <path d={BLOB} transform="translate(100 100)" fill="currentColor" />
    </svg>
  );
}

function Dots({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute bg-[radial-gradient(currentColor_1.6px,transparent_1.8px)] bg-[length:18px_18px] ${className}`}
      aria-hidden
    />
  );
}

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-[2.2rem] bg-home-cocoa p-[7px] shadow-[0_30px_60px_-20px_rgb(59_46_37/0.5)] ${className}`}>
      <img src={src} alt={alt} width={390} height={844} loading="lazy" decoding="async" className="block h-auto w-full rounded-[1.8rem]" />
    </div>
  );
}

/**
 * One of the homepage animations: a HyperFrames composition (videos/<name>/,
 * copied to public/anim/ by `npm run anim`) in a see-through frame over its
 * picture box. The canvas is bigger than the box so phones can move past its
 * edges; `box` is where the box sits on the canvas (x, y, w, h in canvas px).
 * It plays itself while on screen and never takes a click.
 */
function Anim({
  name,
  canvas: [cw, ch],
  box: [bx, by, bw, bh],
  label,
  eager = false,
}: {
  name: string;
  canvas: [number, number];
  box: [number, number, number, number];
  label: string;
  eager?: boolean;
}) {
  return (
    <>
      <iframe
        src={`${BASE_PATH}/anim/${name}/play.html?v=${ANIM_V}#embed`}
        title={label}
        aria-hidden
        tabIndex={-1}
        loading={eager ? "eager" : "lazy"}
        className="pointer-events-none absolute border-0 bg-transparent"
        style={{ left: `${(-bx / bw) * 100}%`, top: `${(-by / bh) * 100}%`, width: `${(cw / bw) * 100}%`, height: `${(ch / bh) * 100}%` }}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

/** A plate seen from above with a doodled dish on it: a butter splash under line art, like a printed cafe menu. */
function Plate({ Dish, className = "" }: { Dish: typeof Bowl; className?: string }) {
  return (
    <div
      className={`grid aspect-square place-items-center rounded-full bg-white shadow-[0_24px_48px_-16px_rgb(59_46_37/0.45)] ${className}`}
      aria-hidden
    >
      <div className="relative grid h-[84%] w-[84%] place-items-center rounded-full border-2 border-dashed border-home-cream">
        <Blob className="inset-0 m-auto h-[62%] w-[62%] translate-x-[6%] translate-y-[6%] text-home-butter" />
        <Dish className="relative w-[58%] text-home-cocoa" strokeWidth={1.3} />
      </div>
    </div>
  );
}

const ICON = "h-6 w-6";
const FACTS = [
  {
    text: "Menu in one tap or scan",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </svg>
    ),
  },
  {
    text: "Questions answered on the dish",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5h16v11H9l-5 4z" />
        <path d="M9 10.5l2 2 4-4" />
      </svg>
    ),
  },
  {
    text: "Order when they're ready",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 8h14l-1.3 12H6.3z" />
        <path d="M9 11V6.5a3 3 0 0 1 6 0V11" />
      </svg>
    ),
  },
  {
    text: "Call the waiter with a tap",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
];

// The five waits tappetite takes away (REMODEL.md, agreed 2026-10-25): what the
// table waits for, and what it has instead. Only what the product does today.
const WAITS = [
  { wait: "Waiting for the menu", now: "It opens on their phone with a tap or a scan." },
  { wait: "Waiting for a waiter to take the order", now: "They send it from the table, when they're ready." },
  { wait: "Waiting to ask what's in a dish, how spicy, how big", now: "Photo, spice, how many it feeds, sizes and price are on the dish." },
  { wait: "Waiting for the menu again, to order more", now: "The menu stays on their phone. They send another round." },
  { wait: "Waving for the bill", now: "They tap Ask for the bill, and the waiter sees it." },
];

const STEPS = [
  { src: "m-home", title: "Tap or scan", text: "The menu opens on the guest's phone, already set to their table.", alt: "A guest's phone with the restaurant's online menu open and greeting her by name, showing today's pick, Kare-Kare, with its price and an Add to order button" },
  { src: "m-menu", title: "Pick dishes", text: "Photos, prices, how many each dish feeds, and what's sold out today.", alt: "The menu on a phone: Filipino dishes with photos, prices and how many people each feeds, under category tabs for Seafood, Chicken, Pork and Beef, one marked not available today" },
  { src: "m-sent", title: "Send to waiter", text: "Everyone at the table orders from their own phone, in rounds.", alt: "A guest's order screen: three dishes sent to the waiter, waiting for the waiter to see them, and the total so far" },
  { src: "s-table", title: "Waiter confirms", text: "Orders arrive by guest. The waiter reads them back and serves.", alt: "The waiter's phone: Table 1's orders grouped by guest and batch, with the table total and a Clear table button" },
];

const PLAN_LIST = PLANS.map((p) => `${p.name} ${peso(p.monthly)} a month or ${peso(p.price)} a year (${p.tables ? `${p.tables} tables with ordering` : "menu only, no ordering"})`).join(", ");
const PAY_WITH = METHODS.filter((m) => m !== "Other").join(", ").replace(/, ([^,]*)$/, " or $1");

// Plain-text answers: the FAQ section shows them and Google reads them (FAQPage below).
const FAQ = [
  {
    q: "What is tappetite?",
    a: "tappetite is an online menu and table ordering system for restaurants and cafes, and it ends the idle waiting at the table. Guests scan or tap their table, see every dish on their own phone with its photo, price, spice and how many it feeds, and send their order straight to your waiter. Nobody waits for a menu, a waiter or an answer.",
  },
  {
    q: "Will guests still talk to my waiters?",
    a: "Only as much as they want to. The waiter greets the table, confirms the order and brings the food. Nobody has to flag a waiter down for a menu, a question about a dish or another round, and guests can call the waiter from the menu whenever they need one.",
  },
  {
    q: "How do I put my restaurant's menu online?",
    a: "Sign up with your email or Google account and add your dishes from your manager login, each with a photo, price and how many people it feeds, sorted into your own categories. That is your online menu. Print each table's QR code from the same login and put it on the table: guests scan it and the menu opens in their phone's browser, with no app to download. Change a price or mark a dish sold out and guests see it right away.",
  },
  {
    q: "How is it different from a QR code menu?",
    a: `A QR menu only shows the menu. With tappetite, guests also order from it: each order goes to your waiter's phone, sorted by guest, and counts toward your sales statistics. The menu opens already set to their table. Guests scan the table's QR code, and restaurants in ${NFC_AREA} also get NFC tags free, so guests can just tap.`,
  },
  {
    q: "Do guests need to download an app?",
    a: "No. The menu opens in the phone's browser, on iPhone and Android. Guests do not make an account; they type a name so the waiter knows whose order is whose.",
  },
  {
    q: "What if a guest's phone can't tap NFC?",
    a: "Every table has a QR code, so any phone with a camera can open the menu. Where there is an NFC tag, most phones from the last few years can tap it; on some Android phones NFC has to be switched on in settings. A guest without a phone can order on a friend's phone at the same table, or tell the waiter, who adds the dishes to the table's order from their own phone.",
  },
  {
    q: "Can someone order from outside the restaurant?",
    a: "The menu link on a guest's phone closes 2 hours after it opens, so a link that was shared or saved stops working. A new tap at the table opens a fresh one. If you ever need to, you can give a table a new link and the old one stops working.",
  },
  {
    q: "How do I change my menu or mark a dish sold out?",
    a: "Your manager logs in and adds or edits dishes with a photo, price and how many people each one feeds, sorted into your own categories. A dish can be marked sold out for the day, and guests see it before they ask for it.",
  },
  {
    q: "What does it cost?",
    a: `Pay by the month or save by paying for the year: ${PLAN_LIST}. Extra tables on ${PLANS[1].name} or ${PLANS[2].name} are ${peso(EXTRA_TABLE / 12)} per table a month (${peso(EXTRA_TABLE)} a year). Plans with tables include a QR code for each table, waiter and manager logins, and sales statistics. Restaurants in ${NFC_AREA} also get an NFC tag for each table, free. Buy again each month or year to keep your menu online.`,
  },
  {
    q: "Can I try it before I pay?",
    a: `Yes. Sign up with your email or Google account and you get 7 days free with every feature on 1 table: your menu online, orders to your waiter's phone, and the statistics. Print the table's QR code from your manager login and put it on the table. When the week is up, pick a plan to keep going; your menu and settings stay as you left them. For restaurants in ${NFC_AREA}, the free NFC tags come with a paid plan.`,
  },
  {
    q: "Does tappetite replace my POS?",
    a: "No. tappetite sits on top of what you already use. Guests' orders arrive on your waiter's phone, and your waiter enters them into your POS as usual, so your POS stays your till and your sales record. If you want a POS or another system built for your restaurant, ask us.",
  },
  {
    q: "How do I pay?",
    a: `Once a year, by ${PAY_WITH}.`,
  },
  {
    q: "Does tappetite take payment from guests?",
    a: "No. Guests pay you the way they always have. tappetite sends their orders to your staff and keeps count of what sells.",
  },
];

// What Google reads about the business and the plans (schema.org).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    // The site name Google shows above the result.
    { "@type": "WebSite", name: "tappetite", alternateName: "tapndine", url: "https://tappetite.click/" },
    {
      "@type": "Organization",
      "@id": "https://tappetite.click/#org",
      name: "TSUJIN IT SOLUTIONS",
      url: "https://tappetite.click/",
      email: "justin.masiga.94@gmail.com",
      areaServed: "PH",
    },
    {
      "@type": "SoftwareApplication",
      name: "tappetite",
      url: "https://tappetite.click/",
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web (iPhone and Android)",
      provider: { "@id": "https://tappetite.click/#org" },
      offers: PLANS.map((p) => ({
        "@type": "Offer",
        name: `${p.name} (${p.tables ? `${p.tables} tables` : "menu only"}, 1 year)`,
        price: p.price,
        priceCurrency: "PHP",
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

/** A plan card's checklist: what it includes, then what it leaves out. */
const H2 = "text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl";
/** The light blue the flat illustrations are drawn on (videos/wait-race). */
const ART_BLUE = "text-[#d6e6fd]";
const PILL = "inline-block rounded-full px-6 py-3 font-semibold transition";

export default async function Home() {
  const demoQr = await QRCode.toString(DEMO_URL, { type: "svg", margin: 0, color: { dark: "#3B2E25", light: "#0000" } });
  return (
    <div className={`${montserrat.className} overflow-x-clip bg-white text-home-cocoa`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      {/* Hero, nav included */}
      <div className="relative overflow-hidden bg-home-shell">
        <Blob className="-left-40 -top-40 w-[560px] text-home-cream" />
        <div className="absolute -right-24 -top-40 hidden h-[640px] w-[640px] rounded-full bg-home-orange md:block" aria-hidden />
        <Dots className="right-4 top-24 hidden h-32 w-40 text-white/80 lg:block" />
        <Chili className="absolute left-[46%] top-24 hidden w-12 -rotate-12 text-home-cocoa/30 md:block" />
        <Leaf className="absolute bottom-10 left-6 w-10 rotate-12 text-home-sage/70" />
        <Drink className="absolute bottom-16 left-[44%] hidden w-11 rotate-6 text-home-cocoa/25 md:block" />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="text-2xl">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-6 text-sm font-semibold">
            <a href="#how" className="hidden opacity-75 hover:opacity-100 md:block">How it works</a>
            <BookDemoButton withLogin className="rounded-full bg-home-cocoa px-5 py-2.5 text-home-shell hover:bg-black">
              Get tappetite
            </BookDemoButton>
          </nav>
        </header>

        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-24 pt-6 sm:px-6 md:grid-cols-2 md:pb-32 md:pt-12">
          <div>
            <h1>
              <span className="mb-4 block text-balance text-sm font-bold uppercase tracking-wider text-home-cocoa/70">
                Online menu &amp; table ordering for restaurants
              </span>
              <span className="block max-w-[13ch] text-balance text-[2.7rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
                No more idle waiting at the table.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium leading-relaxed text-home-cocoa/75">
              Guests tap or scan the table and your online menu opens on their phone: photos, prices, spice, sizes, how
              many each dish feeds. They order when they&apos;re ready, and it goes straight to your waiter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#pricing" className={`${PILL} bg-home-orange hover:brightness-95`}>
                See pricing
              </a>
              <a href={`${BASE_PATH}${DEMO_PATH}`} className={`${PILL} border-2 border-home-cocoa hover:bg-home-cocoa hover:text-home-shell`}>
                Try the menu
              </a>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[520px]">
            <div className="absolute -right-8 -top-6 h-[80%] w-[80%] rounded-full bg-home-orange md:hidden" aria-hidden />
            <Blob className={`inset-0 m-auto h-[96%] w-[96%] ${ART_BLUE}`} />
            {/* One table with tappetite: tap, the dish answers, the order goes, the food comes (videos/table-hero) */}
            <Anim
              name="table-hero"
              canvas={[1080, 1080]}
              box={[0, 0, 1080, 1080]}
              eager
              label="A couple at a table: he taps the table stand, the Pork Sisig card shows its photo, spice, how many it feeds and price, the order goes to the waiter, and the food arrives."
            />
            <div className="absolute -left-2 top-0 grid h-24 w-24 rotate-[-8deg] place-items-center rounded-full bg-home-butter text-center shadow-lg sm:h-28 sm:w-28">
              <p className="text-xs font-semibold leading-tight">
                From
                <span className="block text-xl font-extrabold sm:text-2xl">{peso(PLANS[0].price)}</span>a year
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Facts, sitting on the hero's edge */}
      <ul className="relative mx-auto -mt-12 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:px-6 md:grid-cols-4 md:gap-5">
        {FACTS.map((f) => (
          <li
            key={f.text}
            className="flex flex-col items-center gap-3 rounded-2xl bg-white px-3 py-5 text-center text-sm font-semibold shadow-[0_16px_40px_-18px_rgb(59_46_37/0.35)]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-home-orange text-white">{f.icon}</span>
            {f.text}
          </li>
        ))}
      </ul>

      {/* The two tables: the same couple, with and without tappetite (videos/wait-race) */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-20 sm:px-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14 md:pb-24 md:pt-28">
        <div className="md:order-2">
          <h2 className={H2}>Same table. Same kitchen.</h2>
          <p className="mt-5 max-w-md text-lg font-medium leading-relaxed text-home-cocoa/75">
            One table waits for a menu, a waiter and answers about the dish. The other is already eating.
          </p>
          <p className="mt-4 max-w-md font-medium leading-relaxed text-home-cocoa/75">
            The kitchen is just as fast for both. With tappetite the order simply gets there sooner, because nobody at the
            table had to wait to place it.
          </p>
        </div>
        <figure className="md:order-1">
          <div className="relative mx-auto aspect-square w-full max-w-[600px] overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_70px_-30px_rgb(59_46_37/0.45)] ring-1 ring-home-cream">
            <Anim
              name="wait-race"
              canvas={[1080, 1080]}
              box={[0, 0, 1080, 1080]}
              label="The same couple at two tables. Without tappetite they wait for a waiter, the menu and answers, and are still waiting at 13 minutes. With tappetite they tap the table, send their order, the waiter reads it back, and they are eating."
            />
          </div>
          <figcaption className="mx-auto mt-3 max-w-[600px] text-center text-sm font-medium text-home-cocoa/60">
            Illustration, not measured times.
          </figcaption>
        </figure>
      </section>

      {/* The five waits, and what each table has instead */}
      <section className="relative bg-home-shell">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 md:py-24">
          <h2 className={`${H2} text-center`}>Every wait, gone.</h2>
          <p className="mx-auto mt-4 max-w-lg text-center font-medium leading-relaxed text-home-cocoa/75">
            Five times a table sits and waits for a waiter, and what tappetite puts there instead.
          </p>
          <ul className="mt-12 divide-y divide-home-cream overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_-24px_rgb(59_46_37/0.35)]">
            {WAITS.map((w) => (
              <li key={w.wait} className="grid gap-2 px-5 py-5 sm:grid-cols-2 sm:items-center sm:gap-8 sm:px-8">
                <p className="flex items-start gap-3 font-semibold text-home-cocoa/60">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span><span className="sr-only">Before: </span>{w.wait}</span>
                </p>
                <p className="flex items-start gap-3 font-bold">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-home-sage text-white">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span><span className="sr-only">With tappetite: </span>{w.now}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Feature: the menu */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
        <div className="relative mx-auto aspect-square w-full max-w-[500px]">
          <Blob className={`inset-0 m-auto h-full w-full ${ART_BLUE}`} />
          {/* One paper menu and three questions, then each guest's own dish card (videos/table-menu) */}
          <Anim
            name="table-menu"
            canvas={[1080, 1080]}
            box={[0, 0, 1080, 1080]}
            label="Three friends share one paper menu and ask: is it spicy, how big is it, what does it look like. Then each has the menu on their own phone, and a dish card answers each question."
          />
        </div>
        <div>
          <h2 className={H2}>Every question, answered on the dish.</h2>
          <p className="mt-5 max-w-md font-medium leading-relaxed text-home-cocoa/75">
            Every dish shows its photo, price, how spicy it is and how many people it feeds, with sizes and add-ons
            where you offer them. Guests search, filter by Seafood or Pork, and see what&apos;s sold out before they ask.
          </p>
          <div className="mt-8 grid max-w-[16rem] grid-cols-2 gap-3">
            {[
              ["1", "tap or scan to open"],
              ["0", "apps to install"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-home-shell px-3 py-4 text-center ring-1 ring-home-cream">
                <p className="text-2xl font-extrabold text-home-orange">{v}</p>
                <p className="mt-1 text-xs font-semibold opacity-70">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature: orders to the waiter */}
      <section className="relative overflow-hidden bg-home-shell">
        <Fish className="absolute right-[48%] top-12 hidden w-16 text-home-cocoa/25 md:block" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div className="md:order-2">
            <div className="relative mx-auto aspect-square w-full max-w-[500px]">
              <Blob className="inset-0 m-auto h-full w-full text-white" />
              {/* Bea, Paolo and Mia each send; each order lands on the waiter's screen under their name (videos/table-waiter) */}
              <Anim
                name="table-waiter"
                canvas={[1080, 1080]}
                box={[0, 0, 1080, 1080]}
                label="Paolo, Bea and Mia each send their order from their phone; each lands on the waiter's screen as its own row, sorted by guest, and the total adds up. The waiter goes to key it into the POS."
              />
            </div>
          </div>
          <div className="md:order-1">
            <h2 className={H2}>Your waiters stop answering and start serving.</h2>
            <p className="mt-5 max-w-md font-medium leading-relaxed text-home-cocoa/75">
              Each guest&apos;s order arrives on the waiter&apos;s phone under the name they chose, sorted by guest.
              Your waiter reads it back, keys it into your POS and brings the food, instead of walking back and forth
              for menus and questions.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {["Guest names", "Order rounds", "Read-back fixes", "Waiter-added items", "Table totals", "Clear table", "Waiter logins"].map((t) => (
                <li key={t} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold ring-1 ring-home-cream">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature: statistics */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
        {/* A HyperFrames loop of the manager's dashboard (videos/dashboard-stats/); its first frame stands still for reduced motion. */}
        <div className="mx-auto w-full max-w-[520px]">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={`${shot("st-dashboard")}?v=${STATS_V}`}
            width={1040}
            height={900}
            aria-label="The manager's dashboard: sales, busy hours by weekday, top dishes and open tables"
            className="block h-auto w-full motion-reduce:hidden"
          >
            <source src={`${BASE_PATH}/landing/st-dashboard.webm?v=${STATS_V}`} type="video/webm" />
            <source src={`${BASE_PATH}/landing/st-dashboard.mp4?v=${STATS_V}`} type="video/mp4" />
          </video>
          <img
            src={`${shot("st-dashboard")}?v=${STATS_V}`}
            alt="The manager's dashboard: sales, busy hours by weekday, top dishes and open tables"
            width={1040}
            height={900}
            loading="lazy"
            className="hidden h-auto w-full motion-reduce:block"
          />
        </div>
        <div>
          <h2 className={H2}>A bonus: see what sells, and when you&apos;re busy.</h2>
          <p className="mt-5 max-w-md font-medium leading-relaxed text-home-cocoa/75">
            On top of the orders, every one is counted, so the manager can see sales by day, the busiest hours of the week, which dishes
            lead and which nobody orders, how long groups stay, and which tables earn the most.
          </p>
          <ul className="mt-6 space-y-3 text-sm font-semibold">
            {["Today, 7 days or 30 days", "Busy hours by weekday", "Dish ranking, best to never ordered", "One table at a time, or all of them"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-home-orange text-white">
                  <CheckIcon className="h-4 w-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative scroll-mt-4 overflow-hidden bg-home-orange">
        <Blob className="-right-32 -top-32 w-[420px] text-home-butter/60" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full border-[28px] border-white/25" aria-hidden />
        <Dots className="left-8 top-10 h-24 w-36 text-white/50" />
        <Cutlery className="absolute right-[12%] top-24 hidden w-14 rotate-12 text-home-cocoa/30 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 md:pt-28">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.6rem]">
            From sitting down to ordering, in four steps.
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-medium leading-relaxed text-home-cocoa/80">
            Put each table&apos;s QR code on it. Guests do the rest from their own phones, and your waiters see every
            order the moment it&apos;s sent.
          </p>
          <ol className="mt-16 grid grid-cols-2 gap-x-5 gap-y-12 text-left lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Phone src={`${shot(s.src)}?v=${STEPS_V}`} alt={s.alt} className="mx-auto w-full max-w-[230px]" />
                <p className="mt-6 flex items-center gap-2.5 text-lg font-bold">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-base">{i + 1}</span>
                  {s.title}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-home-cocoa/80">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="mx-auto mt-16 flex max-w-2xl flex-col items-center gap-6 rounded-3xl bg-home-shell p-6 text-center shadow-[0_20px_50px_-24px_rgb(59_46_37/0.45)] sm:flex-row sm:p-8 sm:text-left">
            <div
              className="hidden h-32 w-32 shrink-0 rounded-2xl bg-white p-3 sm:block [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="QR code that opens the demo menu"
              dangerouslySetInnerHTML={{ __html: demoQr }}
            />
            <div className="w-full min-w-0 flex-1">
              <h3 className="text-2xl font-extrabold tracking-tight">Try the menu yourself</h3>
              <p className="mt-2 font-medium leading-relaxed text-home-cocoa/80">
                <span className="hidden sm:inline">Scan the code with your phone camera, or open it here. </span>
                It is the same menu your guests get, with a demo restaurant&apos;s dishes.
              </p>
              <a
                href={`${BASE_PATH}${DEMO_PATH}`}
                className={`${PILL} mt-5 block w-full text-center bg-home-cocoa text-home-shell hover:bg-black`}
              >
                Open the demo menu
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Statement, between two plates */}
      <section className="relative overflow-hidden bg-home-cream">
        <Plate Dish={Shrimp} className="absolute -left-10 top-1/2 hidden w-60 -translate-y-1/2 lg:block" />
        <Plate Dish={Fish} className="absolute -right-10 top-1/2 hidden w-60 -translate-y-1/2 lg:block" />
        <Leaf className="absolute left-[16%] top-12 w-10 -rotate-12 text-home-sage/70" />
        <Chili className="absolute bottom-12 right-[16%] w-11 text-home-orange/70" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 md:py-32">
          <p className="text-2xl font-bold leading-snug tracking-tight sm:text-[2rem] sm:leading-snug">
            Guests{" "}
            <mark className="rounded-md bg-home-butter px-1.5 text-home-cocoa [box-decoration-break:clone]">
              order when they&apos;re ready
            </mark>
            , not when a waiter is free. Your staff spend the shift bringing food out instead of writing it down.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative scroll-mt-4 overflow-hidden bg-home-shell">
        <Blob className="-left-40 top-10 w-[480px] text-home-cream" />
        <Bowl className="absolute right-[14%] top-14 hidden w-14 text-home-cocoa/25 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">Pricing</h2>
          <p className="mx-auto mt-4 max-w-md text-center font-medium text-home-cocoa/75">
            Pay by the month, or save by paying for the year: your menu online on its own, or with ordering by how many
            tables you have.
          </p>
          <Link
            href="/start"
            className="mx-auto mt-5 flex w-fit items-center rounded-full bg-home-butter px-5 py-2.5 text-center text-sm font-bold transition hover:brightness-95"
          >
            Try it free for 7 days on 1 table &rarr;
          </Link>
          <HomePlans />
          <div className="mx-auto mt-5 flex max-w-5xl flex-col items-center justify-between gap-2 rounded-3xl bg-white px-6 py-5 text-center shadow-[0_20px_50px_-24px_rgb(59_46_37/0.4)] sm:flex-row sm:text-left">
            <div>
              <h3 className="text-lg font-bold">Extra tables</h3>
              <p className="text-sm font-medium text-home-cocoa/70">Add tables to {PLANS[1].name} or {PLANS[2].name}, one at a time.</p>
            </div>
            <p>
              <span className="text-2xl font-extrabold tracking-tight">{peso(EXTRA_TABLE / 12)}</span>
              <span className="text-sm font-semibold opacity-60"> per table a month</span>
              <span className="block text-sm font-medium text-home-cocoa/70">{peso(EXTRA_TABLE)} a year</span>
            </p>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-center text-sm font-semibold text-home-cocoa/75">
            Free NFC tags for restaurants in {NFC_AREA}: guests just tap the table instead of scanning.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative scroll-mt-4 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className={`${H2} text-center`}>Questions restaurant owners ask</h2>
          <div className="mt-12 divide-y divide-home-cream border-y border-home-cream">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-home-shell text-xl leading-none transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 font-medium leading-relaxed text-home-cocoa/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
