import { IBM_Plex_Sans_Arabic, Kaushan_Script, Lalezar, Plus_Jakarta_Sans } from "next/font/google";

/** Body text (brand font). */
export const latin = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-latin",
  display: "swap",
});

export const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

/**
 * Stand-in for Haydes, the brand's script face for feature headings, until the
 * licensed web font file is supplied. Swap it here when it arrives.
 */
export const script = Kaushan_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

/** Big Arabic headings. */
export const arabicDisplay = Lalezar({
  subsets: ["arabic"],
  weight: "400",
  variable: "--font-arabic-display",
  display: "swap",
});
