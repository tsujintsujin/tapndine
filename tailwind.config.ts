import type { Config } from "tailwindcss";

// The palette lives in CSS variables (app/globals.css) so one class swaps it:
// guests and waiters get the homepage's warm theme, the manager's dashboard
// keeps the original greens (.theme-green). Roles, whatever the theme:
//   forest  the dark "stage": headers, toasts, the order bar
//   leaf    anything you press
//   mango   what the eye scans for: the pick tag, prices, the order count
//   chili   lit chilies and nothing else
//   paper   the page; wash and line for quieter fills and rules
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: { xs: "360px" },
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        wash: "rgb(var(--wash) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        forest: { DEFAULT: "rgb(var(--forest) / <alpha-value>)", soft: "rgb(var(--forest-soft) / <alpha-value>)" },
        leaf: { DEFAULT: "rgb(var(--leaf) / <alpha-value>)", dark: "rgb(var(--leaf-dark) / <alpha-value>)", tint: "rgb(var(--leaf-tint) / <alpha-value>)" },
        mango: { DEFAULT: "rgb(var(--mango) / <alpha-value>)", soft: "rgb(var(--mango-soft) / <alpha-value>)" },
        chili: "#C8331E",
        // The homepage (app/page.tsx) has its own warm palette.
        home: {
          mist: "#DDE2E6",
          cream: "#F4EACE",
          shell: "#FFF9E7",
          butter: "#FAD68A",
          orange: "#F19A33",
          sage: "#85A55E",
          cocoa: "#3B2E25",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
