import { Bowl, Chili, Drink, Fish, Leaf, Shrimp } from "@/app/Doodles";

// The homepage's backdrop behind the guest menu and the waiter screens: soft
// cream and butter shapes, a dot grid and faint food doodles, fixed behind
// the content so the layout above it is untouched. The big shapes sit clear
// of the sticky header and the bottom bar, which would slice them. Decorative only.

export default function WarmBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-56 top-[210px] h-[460px] w-[460px] rounded-full bg-home-cream/80" />
      <div className="absolute -right-56 top-[52%] h-[440px] w-[440px] rounded-full bg-home-butter/35" />
      <div
        className="absolute right-8 top-28 hidden h-28 w-36 lg:block"
        style={{ backgroundImage: "radial-gradient(rgb(241 154 51 / 0.45) 1.6px, transparent 1.6px)", backgroundSize: "14px 14px" }}
      />
      <Chili className="absolute left-[7%] top-[22%] hidden w-11 -rotate-12 text-home-cocoa/25 md:block" />
      <Leaf className="absolute bottom-[18%] left-[5%] hidden w-10 rotate-12 text-home-sage/70 md:block" />
      <Bowl className="absolute bottom-[38%] right-[6%] hidden w-14 text-home-cocoa/20 md:block" />
      <Drink className="absolute left-[9%] top-[58%] hidden w-11 rotate-6 text-home-cocoa/20 lg:block" />
      <Fish className="absolute right-[9%] top-[64%] hidden w-14 text-home-cocoa/20 lg:block" />
      <Shrimp className="absolute right-[10%] top-[8%] hidden w-12 text-home-orange/50 md:block" />
    </div>
  );
}
