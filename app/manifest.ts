import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "拼豆图纸生成器",
    short_name: "拼豆图纸",
    description: "照片转 MARD 291 色拼豆图纸",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf7",
    theme_color: "#182235",
    icons: [{ src: "/logo.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
