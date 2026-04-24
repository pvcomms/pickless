import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sumi: {
          bg: "#0f0f0d",
          paper: "#161613",
          ink: "#eeeae0",
          faint: "#7a7668",
          line: "rgba(238,234,224,0.16)",
          seal: "#c23a2a",
        },
        washi: {
          bg: "#f3ede1",
          paper: "#ede6d6",
          ink: "#1a1915",
          faint: "#8f8878",
          line: "rgba(26,25,21,0.18)",
          seal: "#9b2a1f",
        },
      },
      fontFamily: {
        display: ["var(--font-instrument)", "Instrument Serif", "serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
        jp: ["var(--font-jp)", "Noto Serif JP", "serif"],
      },
      letterSpacing: { wider2: "0.18em", widest2: "0.22em" },
    },
  },
} satisfies Config;
