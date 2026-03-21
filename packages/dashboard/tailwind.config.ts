import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
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
        cream: "#f5efe0",
        // ranger UI tokens - warm parchment theme
        "ranger-bg": "#E8E5DE",
        "ranger-card": "#F2EFE8",
        "ranger-border": "#CBC8C0",
        "ranger-muted": "#7A7670",
        "ranger-text": "#1C2417",
        "ranger-moss": "#4a7c5a",
        "ranger-apricot": "#B86F0A",
        "ranger-spice": "#A84E2A",
        "ranger-footer": "#DEDAD2"
      }
    }
  },
  plugins: []
};

export default config;
