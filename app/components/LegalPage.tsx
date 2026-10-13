import Link from "next/link";
import { Montserrat } from "next/font/google";
import { Wordmark } from "./Wordmark";
import { SiteFooter } from "./SiteFooter";

// The layout of the Terms of Service and the Privacy Policy: numbered sections in plain language.

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export type LegalSection = { title: string; body: React.ReactNode };

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className={`${montserrat.className} overflow-x-clip bg-white text-home-cocoa`}>
      <div className="bg-home-shell">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="text-2xl">
            <Wordmark />
          </Link>
          <Link href="/" className="text-sm font-semibold opacity-75 hover:opacity-100">
            Back to home
          </Link>
        </header>
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-8 sm:px-6 md:pb-20 md:pt-14">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 font-medium text-home-cocoa/75">Last updated {updated}</p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
        <ol className="space-y-12">
          {sections.map((s, i) => (
            <li key={s.title}>
              <h2 className="flex items-baseline gap-3 text-xl font-bold sm:text-2xl">
                <span className="text-home-orange">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="mt-4 space-y-4 font-medium leading-relaxed text-home-cocoa/80">{s.body}</div>
            </li>
          ))}
        </ol>
      </main>

      <SiteFooter />
    </div>
  );
}
