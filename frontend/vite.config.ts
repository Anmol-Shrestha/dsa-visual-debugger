import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works on GitHub Pages project sites.
  base: "./",
  server: {
    proxy: {
      // Forward API calls to the FastAPI backend during development.
      "/v1": "http://localhost:8000",
    },
  },
});
