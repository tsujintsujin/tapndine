import type { Config } from "tailwindcss";

// Prototype palette. The food photos carry most of the colour.
//   forest  the "stage": header, hero and best sellers sit on it
//   leaf    anything you press
//   mango   what the eye scans for: the pick tag, prices, the order count
//   chili   lit chilies and nothing else
//   paper   the lighter menu below the stage
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: { xs: "360px" },
      colors: {
        ink: "#1A1A1A",
        muted: "#5E6660",
        line: "#E1E5DF",
        wash: "#EEF1EC",
        paper: "#F5F6F2",
        forest: { DEFAULT: "#10342A", soft: "#1A4538" },
        leaf: { DEFAULT: "#1F5C3F", dark: "#174630", tint: "#E3EEE7" },
        mango: { DEFAULT: "#F2B233", soft: "#FCEFCB" },
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
