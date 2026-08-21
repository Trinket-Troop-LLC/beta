import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trinket Troop",
    short_name: "Trinket Troop",
    description:
      "A friendlier way to buy, sell, trade, and gift secondhand treasures in New York City.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbe9d1",
    theme_color: "#877c27",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
