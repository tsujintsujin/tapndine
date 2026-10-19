import type { Metadata } from "next";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { BASE_PATH } from "@/lib/base";
import { METHODS, PLANS } from "@/lib/plans";
import { CheckIcon } from "@/app/components/Icons";
import { Wordmark } from "@/app/components/Wordmark";
import { SiteFooter } from "@/app/components/SiteFooter";
import QRCode from "qrcode";
import { BookDemoButton } from "./BookDemo";
import { Bowl, Chili, Cutlery, Drink, Fish, Leaf, Shrimp } from "./Doodles";

// The tapndine homepage: what it is, for restaurant owners. The product screens
// are real captures of a test run at the sample restaurant (public/landing/);
// the round "plates" are doodles (Doodles.tsx), not photos. The moving pictures
// (hero, menu, waiter) are HyperFrames compositions: source in videos/, served
// from public/anim/ (see Anim below).

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

// Search terms this page is written for: digital menu, online menu, table ordering
// system, QR code menu (tapndine is the no-scan alternative), restaurants and cafes
// in the Philippines. Keep them in the description, the H1 line and the body copy.
// The title is the brand alone, like any site's home page: it is what the browser
// tab, bookmarks, home-screen icon and share card show.
const TITLE = "tapndine";
const DESCRIPTION =
  "Digital menu and table ordering for Philippine restaurants and cafes. Guests tap the table, order on their phone, and it reaches your waiter. From ₱2,100 a year.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: "tapndine", title: TITLE, description: DESCRIPTION, locale: "en_PH" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  appleWebApp: { title: TITLE },
};

const CONTACT = "mailto:justin.masiga.94@gmail.com?subject=tapndine%20for%20my%20restaurant";
const shot = (name: string) => `${BASE_PATH}/landing/${name}.webp`;
// Bump when the stats loop is re-rendered: browsers keep cached video by URL.
const STATS_V = "2";

const EVERY_PLAN = [
  "An NFC tag on every table",
  "Menu with photos, online",
  "Orders straight to the waiter",
  "Waiter and manager logins",
  "Sales and busy-hour statistics",
];
const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
/** A plan's yearly price per table per month: ₱2,100 for 10 tables is ₱17.50. */
const perTableMonth = (p: { price: number; tables: number }) =>
  "₱" + (p.price / p.tables / 12).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The demo restaurant's "Not at a table" link: the real guest menu, to look
 * through, with no waiter to send to. Same tag on the live site and in the
 * seed data (seed/dev.sql).
 */
const DEMO_PATH = "/t/h3nd6vya";
const DEMO_URL = `https://tapndine.online${DEMO_PATH}`;

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
        src={`${BASE_PATH}/anim/${name}/play.html#embed`}
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
    text: "Nothing to download",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </svg>
    ),
  },
  {
    text: "Works on iPhone and Android",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <path d="M6 8a8 8 0 0 1 0 8M10 5.5a12 12 0 0 1 0 13M14 3a16 16 0 0 1 0 18" />
      </svg>
    ),
  },
  {
    text: "Menu link closes after 2 hours",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    text: "Light on mobile data",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <path d="M5 19v-3M10 19v-6M15 19v-9M20 19V6" />
      </svg>
    ),
  },
];

const STEPS = [
  { src: "m-home", title: "Tap the tag", text: "The menu opens on the guest's phone, already set to their table.", alt: "A guest's phone opened at Table 1, showing today's pick, Kare-Kare, with its price and an Add to order button" },
  { src: "m-menu", title: "Pick dishes", text: "Photos, prices, how many each dish feeds, and what's sold out today.", alt: "The menu on a phone: Filipino dishes with photos, prices and how many people each feeds, filtered by Seafood, Chicken, Pork and Beef" },
  { src: "m-sent", title: "Send to waiter", text: "Everyone at the table orders from their own phone, in rounds.", alt: "A guest's order screen: three dishes sent to the waiter and the total so far" },
  { src: "s-table", title: "Waiter confirms", text: "Orders arrive by guest. The waiter reads them back and serves.", alt: "The waiter's phone: Table 1's orders grouped by guest and batch, with the table total and a Clear table button" },
];

const PLAN_LIST = PLANS.map((p) => `${peso(p.price)} a year for ${p.tables} tables`).join(", ");
const PAY_WITH = METHODS.filter((m) => m !== "Other").join(", ").replace(/, ([^,]*)$/, " or $1");

// Plain-text answers: the FAQ section shows them and Google reads them (FAQPage below).
const FAQ = [
  {
    q: "What is tapndine?",
    a: "tapndine is a digital menu and table ordering system for restaurants and cafes in the Philippines. Guests tap the NFC tag on their table with their phone, browse your online menu with photos, and send their order straight to your waiter.",
  },
  {
    q: "How is it different from a QR code menu?",
    a: "Guests tap the tag instead of opening the camera to scan, and the menu opens already set to their table. And it is more than a menu to look at: orders go to the waiter's phone, sorted by guest, and every order counts toward your sales statistics. If you want a printed QR code on the table too, each table's link can be downloaded as one.",
  },
  {
    q: "Do guests need to download an app?",
    a: "No. The menu opens in the phone's browser, on iPhone and Android. Guests do not make an account; they type a name so the waiter knows whose order is whose.",
  },
  {
    q: "What if a guest's phone can't tap NFC?",
    a: "Most phones from the last few years read NFC tags; on some Android phones NFC has to be switched on in settings. A guest who can't tap can scan the table's QR code if you print one, order on a friend's phone at the same table, or tell the waiter, who adds the dishes to the table's order from their own phone.",
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
    a: `One yearly price by number of tables: ${PLAN_LIST}. Every plan includes an NFC tag for each table, waiter and manager logins, and sales statistics. Renew at the same rate to keep your menu online.`,
  },
  {
    q: "Can I try it before I pay?",
    a: "Yes. You get one week free with the full system: your menu online, orders to your waiters' phones, and the statistics. The trial uses QR codes instead of NFC tags: print each table's code from your manager login and put it on the table. NFC tags come with a paid plan.",
  },
  {
    q: "Does tapndine replace my POS?",
    a: "No. tapndine sits on top of what you already use. Guests' orders arrive on your waiter's phone, and your waiter enters them into your POS as usual, so your POS stays your till and your sales record. If you want a POS or another system built for your restaurant, ask us.",
  },
  {
    q: "How do I pay?",
    a: `Once a year, by ${PAY_WITH}.`,
  },
  {
    q: "Does tapndine take payment from guests?",
    a: "No. Guests pay you the way they always have. tapndine sends their orders to your staff and keeps count of what sells.",
  },
];

// What Google reads about the business and the plans (schema.org).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    // The site name Google shows above the result.
    { "@type": "WebSite", name: "tapndine", alternateName: "tapndine.online", url: "https://tapndine.online/" },
    {
      "@type": "Organization",
      "@id": "https://tapndine.online/#org",
      name: "TSUJIN IT SOLUTIONS",
      url: "https://tapndine.online/",
      email: "justin.masiga.94@gmail.com",
      areaServed: "PH",
    },
    {
      "@type": "SoftwareApplication",
      name: "tapndine",
      url: "https://tapndine.online/",
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web (iPhone and Android)",
      provider: { "@id": "https://tapndine.online/#org" },
      offers: PLANS.map((p) => ({
        "@type": "Offer",
        name: `${p.name} (${p.tables} tables, 1 year)`,
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

const H2 = "text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl";
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
              Get tapndine
            </BookDemoButton>
          </nav>
        </header>

        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-24 pt-6 sm:px-6 md:grid-cols-2 md:pb-32 md:pt-12">
          <div>
            <h1>
              <span className="mb-4 block text-balance text-sm font-bold uppercase tracking-wider text-home-cocoa/70">
                Digital menu &amp; table ordering in the Philippines
              </span>
              <span className="block text-[2.7rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
                Tap the table.
                <br />
                The menu opens.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium leading-relaxed text-home-cocoa/75">
              Guests tap the NFC tag on their table, browse your online menu with photos, and send their order straight
              to the waiter. No app to install, no paper menus to wipe down.
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
            <Plate Dish={Bowl} className="absolute right-0 top-[2%] w-[64%]" />
            {/* The phone and the table's tap tag: one dinner, start to finish, looping */}
            <Anim
              name="hero-loop"
              canvas={[1400, 1200]}
              box={[200, 60, 1080, 1080]}
              eager
              label="A guest taps the table tag, orders on their phone, and the order arrives on the waiter's phone."
            />
            <div className="absolute bottom-[10%] right-[4%] grid h-28 w-28 rotate-[-8deg] place-items-center rounded-full bg-home-butter text-center shadow-lg sm:h-32 sm:w-32">
              <p className="text-xs font-semibold leading-tight">
                From
                <span className="block text-xl font-extrabold sm:text-2xl">₱2,100</span>a year
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

      {/* Feature: the menu */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
        <div className="relative mx-auto aspect-[420/520] w-full max-w-[420px]">
          <Blob className="inset-0 m-auto h-full w-full scale-110 text-home-butter" />
          <Bowl className="absolute -left-2 top-2 w-14 text-home-cocoa/30" />
          <Shrimp className="absolute -right-2 bottom-4 w-14 text-home-cocoa/30" />
          {/* A thick paper menu flips through its pages and turns into one phone; plays once */}
          <Anim
            name="menu-booklet"
            canvas={[1300, 1550]}
            box={[125, 125, 1050, 1300]}
            label="A thick paper menu folds shut and becomes a phone showing the whole menu, filtered to Seafood."
          />
        </div>
        <div>
          <h2 className={H2}>Your whole menu, on every phone at the table.</h2>
          <p className="mt-5 max-w-md font-medium leading-relaxed text-home-cocoa/75">
            Your digital menu gives every dish a photo, its price and how many people it feeds. Guests search,
            filter by Seafood or Pork, and see what&apos;s sold out today before they ask for it.
          </p>
          <div className="mt-8 grid max-w-sm grid-cols-3 gap-3">
            {[
              ["1", "tap to open"],
              ["0", "apps to install"],
              ["2 h", "then the link closes"],
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
            <div className="relative mx-auto aspect-[1050/1368] w-full max-w-[420px]">
              <div className="absolute -right-10 -top-6 h-64 w-64 rounded-full bg-home-butter" aria-hidden />
              {/* Each guest's order flies into the waiter's phone as its own card; then the table is cleared */}
              <Anim
                name="waiter-orders"
                canvas={[1350, 1620]}
                box={[150, 100, 1050, 1368]}
                label="Bea, Paolo and Mia each send an order; each lands on the waiter's phone as its own card and the table total adds up."
              />
            </div>
          </div>
          <div className="md:order-1">
            <h2 className={H2}>Orders reach the waiter, sorted by guest.</h2>
            <p className="mt-5 max-w-md font-medium leading-relaxed text-home-cocoa/75">
              Table ordering without the wait: each phone at the table shows up as its own guest, with the name they
              chose. Your waiter reads the order back, fixes a quantity, adds what was asked for out loud, and clears
              the table once it&apos;s paid.
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
          <h2 className={H2}>See what sells, and when you&apos;re busy.</h2>
          <p className="mt-5 max-w-md font-medium leading-relaxed text-home-cocoa/75">
            Every order is counted, so the manager can see sales by day, the busiest hours of the week, which dishes
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
            From the tap to the table, in four steps.
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-medium leading-relaxed text-home-cocoa/80">
            Put a tag on each table. Guests do the rest from their own phones, and your waiters see every order the
            moment it&apos;s sent.
          </p>
          <ol className="mt-16 grid grid-cols-2 gap-x-5 gap-y-12 text-left lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Phone src={shot(s.src)} alt={s.alt} className="mx-auto w-full max-w-[230px]" />
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
            <div className="min-w-0">
              <h3 className="text-2xl font-extrabold tracking-tight">Try the menu yourself</h3>
              <p className="mt-2 font-medium leading-relaxed text-home-cocoa/80">
                <span className="hidden sm:inline">Scan the code with your phone camera, or open it here. </span>
                It is the same menu your guests get, with a demo restaurant&apos;s dishes.
              </p>
              <a
                href={`${BASE_PATH}${DEMO_PATH}`}
                className={`${PILL} mt-5 bg-home-cocoa text-home-shell hover:bg-black`}
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
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">Pricing</h2>
          <p className="mx-auto mt-4 max-w-md text-center font-medium text-home-cocoa/75">
            One price a year for your restaurant or cafe, by how many tables you have. Renew at the same rate to keep
            your menu online.
          </p>
          <p className="mx-auto mt-4 w-fit rounded-full bg-home-butter px-4 py-1.5 text-center text-sm font-bold">
            Try it free for a week, with QR codes
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className="flex flex-col rounded-3xl bg-white p-6 shadow-[0_20px_50px_-24px_rgb(59_46_37/0.4)]">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-1 text-sm font-semibold text-home-orange">{p.tables} tables</p>
                <p className="mt-6">
                  <span className="text-4xl font-extrabold tracking-tight">{peso(p.price)}</span>
                  <span className="text-sm font-semibold opacity-60"> / year</span>
                </p>
                <p className="mt-1 text-sm font-medium text-home-cocoa/70">{perTableMonth(p)} per table a month</p>
                <a href={`${CONTACT}%20(${encodeURIComponent(p.name)})`} className={`${PILL} mt-8 bg-home-orange text-center hover:brightness-95`}>
                  Choose {p.name.replace(" Plan", "")}
                </a>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-3xl bg-white/70 px-6 py-6 ring-1 ring-home-cream">
            <h3 className="text-center font-bold">Every plan includes</h3>
            <ul className="mt-4 grid gap-x-6 gap-y-3 text-sm font-medium sm:grid-cols-2 lg:grid-cols-3">
              {EVERY_PLAN.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-home-sage text-white">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
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
