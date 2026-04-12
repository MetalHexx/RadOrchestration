import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      height: {
        page: "calc(100dvh - 3.5rem)",
      },
      minHeight: {
        page: "calc(100dvh - 3.5rem)",
      },
    },
  },
  plugins: [],
};
export default config;
