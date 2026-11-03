/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        // Code font stack: JetBrains Mono, then Fira Code, then system fallbacks.
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
