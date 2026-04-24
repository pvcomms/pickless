import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pickless",
    short_name: "Pickless",
    description:
      "Stop choosing. Start eating. The agent picks your meal and orders it.",
    start_url: "/app",
    display: "standalone",
    background_color: "#0f0f0d",
    theme_color: "#c23a2a",
    orientation: "portrait",
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
