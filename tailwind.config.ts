import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // DormDrop brand — dark emerald green. #064e3b is brand-900 and is the
        // primary brand colour (logo mark + primary buttons).
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        // Warm amber accent — energy, earnings, urgency.
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        // Semantic aliases used across feedback states.
        success: "#10b981",
        danger: "#ef4444",
      },
      fontFamily: {
        // Plus Jakarta Sans — modern, friendly, not corporate. One family for
        // body + display (the `font-display` utility just uses heavier weights).
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Soft, lifted card shadow used throughout the polished UI.
        soft: "0 1px 2px rgba(28,25,23,0.04), 0 8px 24px -12px rgba(28,25,23,0.12)",
        "soft-lg":
          "0 2px 4px rgba(28,25,23,0.05), 0 16px 40px -16px rgba(28,25,23,0.18)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "translateY(4px) scale(0.85)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "cart-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-tilt": {
          "0%, 100%": { transform: "translateY(0) rotate(-5deg)" },
          "50%": { transform: "translateY(-16px) rotate(5deg)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.45)" },
          "50%": { boxShadow: "0 0 0 6px rgba(16,185,129,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "page-in": "page-in 0.28s cubic-bezier(0.22,1,0.36,1)",
        "pop-in": "pop-in 0.22s cubic-bezier(0.22,1,0.36,1)",
        "cart-pop": "cart-pop 0.32s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "sheet-up": "sheet-up 0.3s cubic-bezier(0.22,1,0.36,1)",
        "slide-down": "slide-down 0.35s cubic-bezier(0.22,1,0.36,1)",
        float: "float 4s ease-in-out infinite",
        "float-slow": "float 6s ease-in-out infinite",
        "float-tilt": "float-tilt 5s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        glow: "glow 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
