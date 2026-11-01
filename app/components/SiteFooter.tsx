import Link from "next/link";
import { BookDemoButton } from "@/app/BookDemo";
import { SocialSoon } from "./SocialSoon";
import { Wordmark } from "./Wordmark";

/** The footer on the homepage, the Terms and the Privacy Policy. */
export function SiteFooter() {
  return (
    <footer className="bg-home-cocoa text-home-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <Wordmark />{" "}
          by <span className="font-bold tracking-wide">TSUJIN IT SOLUTIONS</span>
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-medium opacity-80">
            <Link href="/#faq" className="hover:underline">FAQ</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <BookDemoButton className="hover:underline">Contact</BookDemoButton>
          </nav>
          <SocialSoon />
        </div>
      </div>
    </footer>
  );
}
