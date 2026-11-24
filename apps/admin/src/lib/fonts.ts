import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

export const latin = Inter({ subsets: ["latin"], variable: "--font-latin", display: "swap" });

export const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});
