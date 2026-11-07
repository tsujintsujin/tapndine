import type { SVGProps } from "react";

// Line icons on a 24px grid, drawn in currentColor so they follow the text
// colour. Kept in one file: they are only ever used together.

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...p }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const MenuIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const BagIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Svg>
);

/** A service bell: the guest calling their waiter. */
export const BellIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 16v-4a6 6 0 0 1 12 0v4l1.5 2h-15L6 16z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
    <path d="M12 4V3" />
  </Svg>
);

export const ClocheIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 17a8 8 0 0 1 16 0" />
    <path d="M2.5 17h19M6 20h12" />
    <circle cx="12" cy="7.5" r="1.5" />
  </Svg>
);

export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Svg>
);

export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 11l8-7 8 7v9H4v-9z" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const PeopleIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c.4-3.4 2.6-5.5 5.5-5.5s5.1 2.1 5.5 5.5" />
    <path d="M16 11.2a2.7 2.7 0 1 0-.6-5.3M17.2 14.3c1.9.5 3 2.3 3.3 5.2" />
  </Svg>
);

// --- Manager screens ---------------------------------------------------------

export const GridIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="4.5" rx="1.5" />
    <rect x="13" y="11" width="7" height="9" rx="1.5" />
    <rect x="4" y="13.5" width="7" height="6.5" rx="1.5" />
  </Svg>
);

/** A table seen from the side. */
export const TableIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 9h18M5 9v10M19 9v10M7 13h10" />
    <path d="M6 5.5h12" />
  </Svg>
);

export const TagIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h7.5L20 12.5 12.5 20 4 11.5V4z" />
    <circle cx="8.5" cy="8.5" r="1.4" />
  </Svg>
);

/** Sliders: the restaurant's settings. */
export const SlidersIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

/** A phone showing a big photo over a row of tiles: the menu's home page. */
export const HomepageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M6 11h12M9 15h.01M12 15h.01M15 15h.01" />
  </Svg>
);

export const EyeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

/** A tap: a dot sending waves out, for NFC links. */
/** A receipt: contracts and payments. */
export const ReceiptIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Svg>
);

/** A card: the restaurant's subscription. */
export const CardIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M7 15h4" />
  </Svg>
);

/** A question in a circle: support. */
export const HelpIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" />
  </Svg>
);

export const NfcIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.6" />
    <path d="M10 8.5a5 5 0 0 1 0 7M13.5 5.5a9.5 9.5 0 0 1 0 13M17 3a13 13 0 0 1 0 18" />
  </Svg>
);

export const CopyIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Svg>
);

export const QrIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18v2M18 14h2" />
  </Svg>
);

export const LogoutIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 4H6v16h8" />
    <path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" />
  </Svg>
);

export const ArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Svg>
);

export const PencilIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
  </Svg>
);

export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 4h4M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
  </Svg>
);

/** Six dots: drag to reorder. */
export const GripIcon = (p: P) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </Svg>
);

export const ImageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M4 17.5l5-4.5 4 3.5 3-2.5 4.5 4" />
  </Svg>
);

export const CheckIcon = (p: P) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const PlateIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
  </Svg>
);

const CHILI_BODY =
  "M5.5 20.5c5.5.3 12-4.6 13.4-10.8.4-1.8-1.2-3.3-3-2.8-1.2.3-1.8 1.4-2.3 2.7-1.6 4.2-4.6 7.3-8.9 8.4-1.8.5-1.4 2.4.8 2.5z";

/** One chili. `lit` fills it; unlit is an outline. */
export const ChiliIcon = ({ lit, ...p }: P & { lit?: boolean }) => (
  <Svg {...p}>
    <path d={CHILI_BODY} fill={lit ? "currentColor" : "none"} />
    <path d="M16.5 7c-.2-1.7.6-3.1 2.3-4" />
  </Svg>
);

/** A chili struck through: "not spicy". */
export const NoChiliIcon = (p: P) => (
  <Svg {...p}>
    <path d={CHILI_BODY} />
    <path d="M16.5 7c-.2-1.7.6-3.1 2.3-4" />
    <path d="M3.5 3.5l17 17" strokeWidth={2} />
  </Svg>
);

// ---- Ingredient kinds -------------------------------------------------------
// The `kind` column in dish_ingredients picks one of these.

const Carrot = (p: P) => (
  <Svg {...p}>
    <path d="M4 20c3-1 9.3-4.3 11.6-6.6a3.2 3.2 0 0 0-4.6-4.6C8.7 11.1 5 17 4 20z" />
    <path d="M9 13l1.5 1.5M7 16.5l1 1" />
    <path d="M15.5 8.5l3-3M14.5 7.5l.5-3.5M16.5 9.5l3.5-.5" />
  </Svg>
);

const Apple = (p: P) => (
  <Svg {...p}>
    <path d="M12 7.5c-2-1.4-6.2-1-6.6 3.2-.4 4.3 2.3 9.1 4.6 9.7 1 .3 1.4-.3 2-.3s1 .6 2 .3c2.3-.6 5-5.4 4.6-9.7C18.2 6.5 14 6.1 12 7.5z" />
    <path d="M12 7.5c0-2 .9-3.5 2.8-4.3" />
  </Svg>
);

const Drumstick = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 3.5a6 6 0 0 1 6 6c0 3.3-3.3 5.5-6.5 5.2l-2.2 2.2-3-3 2.2-2.2c-.4-3.4 1.2-8.2 3.5-8.2z" />
    <path d="M8.8 13.9l-3.4 3.4" />
    <circle cx="4.5" cy="18.8" r="1.4" />
    <circle cx="6.2" cy="20.4" r="1.2" />
  </Svg>
);

const Pig = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="7.5" />
    <ellipse cx="12" cy="15" rx="3" ry="2.1" />
    <path d="M11 15h.01M13 15h.01" strokeWidth={2.2} />
    <path d="M6.6 8L5.2 3.8 9 5.8M17.4 8l1.4-4.2L15 5.8" />
    <path d="M9 11h.01M15 11h.01" strokeWidth={2.2} />
  </Svg>
);

const Steak = (p: P) => (
  <Svg {...p}>
    <path d="M5.2 9.5C7.5 4.8 16 3.6 19 8.2c3 4.6-.3 11-5.8 11.4-5.4.4-8.3-1.6-9.5-4.8-.7-1.9.4-3.4 1.5-5.3z" />
    <circle cx="10" cy="13" r="1.8" />
    <path d="M14 9c1.8.4 3 1.7 3.2 3.4" />
  </Svg>
);

const Shrimp = (p: P) => (
  <Svg {...p}>
    <path d="M6 9c2.8-3.4 10.6-3.6 12.6 1.6 1.8 4.7-1.6 9-5.8 9-2.9 0-4.8-2.2-4.2-4.4.5-1.6 2.2-2.3 3.8-1.4" />
    <path d="M13 7.3l.8 3.2M16.6 9l-1.4 2.8M18.6 13l-2.8.4" />
    <path d="M6 9L3 6.5M6.8 8.2L6 4.5" />
  </Svg>
);

const Fish = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12c3-4.3 9.2-6 14-2.8l4-3.2v12l-4-3.2c-4.8 3.2-11 1.5-14-2.8z" />
    <path d="M7.5 11.2h.01" strokeWidth={2.4} />
  </Svg>
);

const Egg = (p: P) => (
  <Svg {...p}>
    <path d="M12 3c-3.6 0-6.2 6.2-6.2 10.3a6.2 6.2 0 0 0 12.4 0C18.2 9.2 15.6 3 12 3z" />
  </Svg>
);

const Carton = (p: P) => (
  <Svg {...p}>
    <path d="M8 3h8v3l2 3.2V21H6V9.2L8 6V3z" />
    <path d="M6 9.2h12M8 6h8" />
  </Svg>
);

const RiceBowl = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" />
    <path d="M6 12c0-2.8 2.7-4.8 6-4.8s6 2 6 4.8" />
    <path d="M14 3l5.5 5.5M16.5 2.5l4 4" />
  </Svg>
);

const Peanut = (p: P) => (
  <Svg {...p}>
    <path d="M12 3a4 4 0 0 0-4 4c0 1.5.8 2.4.8 3.5S8 12.5 8 14a4 4 0 0 0 8 0c0-1.5-.8-2.4-.8-3.5S16 8.5 16 7a4 4 0 0 0-4-4z" />
    <path d="M11 6.5h.01M13 9h.01M11 13.5h.01M13 16h.01" strokeWidth={2} />
  </Svg>
);

const Leaf = (p: P) => (
  <Svg {...p}>
    <path d="M5 19C5 10.5 10.3 5 19 5c0 8.8-5.6 14-14 14z" />
    <path d="M5 19l8.5-8.5" />
  </Svg>
);

const Bottle = (p: P) => (
  <Svg {...p}>
    <path d="M10 2.5h4V7l2.2 3V21H7.8V10L10 7V2.5z" />
    <path d="M7.8 13.5h8.4" />
  </Svg>
);

const SugarCube = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </Svg>
);

const SpiceChili = (p: P) => <ChiliIcon {...p} />;

export const INGREDIENT_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  vegetable: Carrot,
  fruit: Apple,
  chicken: Drumstick,
  pork: Pig,
  beef: Steak,
  seafood: Shrimp,
  fish: Fish,
  egg: Egg,
  milk: Carton,
  grain: RiceBowl,
  nut: Peanut,
  herb: Leaf,
  spice: SpiceChili,
  sauce: Bottle,
  sweet: SugarCube,
};

/** Human label for each kind, read out to screen readers beside the icon. */
export const INGREDIENT_LABELS: Record<string, string> = {
  vegetable: "Vegetable",
  fruit: "Fruit",
  chicken: "Chicken",
  pork: "Pork",
  beef: "Beef",
  seafood: "Seafood",
  fish: "Fish",
  egg: "Egg",
  milk: "Milk",
  grain: "Grain",
  nut: "Nut",
  herb: "Herb",
  spice: "Spice",
  sauce: "Sauce",
  sweet: "Sweetener",
};
