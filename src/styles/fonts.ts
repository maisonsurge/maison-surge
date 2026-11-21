import { Montserrat, Playfair_Display } from "next/font/google";

// Both families are SIL Open Font License; self-hosted by next/font at build
// time (no runtime request to Google). latin-ext covers Turkish characters.
export const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-playfair",
});

export const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-montserrat",
});
