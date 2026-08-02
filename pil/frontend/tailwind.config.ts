import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#0a0e17",
          surface: "#141a26",
          surface2: "#1b2333",
          border: "#2a3244",
          accent: "#5b7fff",
          accent2: "#a855f7",
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#f43f5e",
        },
      },
      backgroundImage: {
        "vault-hero": "linear-gradient(135deg, #1b2340 0%, #241a3d 55%, #141a26 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
