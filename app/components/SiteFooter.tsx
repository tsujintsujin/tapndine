import Link from "next/link";
import { BookDemoButton } from "@/app/BookDemo";
import { Wordmark } from "./Wordmark";

/** The footer on the homepage and the Terms page. */
export function SiteFooter() {
  return (
    <footer className="bg-home-cocoa text-home-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <Wordmark />{" "}
          by <span className="font-bold tracking-wide">TSUJIN IT SOLUTIONS</span>
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-medium opacity-80">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <BookDemoButton className="hover:underline">Contact</BookDemoButton>
        </nav>
      </div>
    </footer>
  );
}
