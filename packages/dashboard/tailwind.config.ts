import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"]
      },
      colors: {
        forest: "#1a3a2a",
        moss: "#2d5a3d",
        sage: "#4a7c5a",
        leaf: "#6aaa7a",
        lime: "#9fd4a0",
        "amber-alert": "#d4820a",
        "coral-alert": "#c85a3a",
        cream: "#f5efe0"
      }
    }
  },
  plugins: []
};

export default config;
