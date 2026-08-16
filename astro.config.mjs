import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://rupeefund.org",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "file",
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !["manage", "thank-you", "vote", "404", "waitlist-confirmed", "waitlist-problem"].some(
          (slug) => page.replace(/\/$/, "").endsWith(`/${slug}`),
        ),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
