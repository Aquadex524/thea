import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thea",
    short_name: "Thea",
    description: "Recipe videos in, groceries out.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#044863",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
