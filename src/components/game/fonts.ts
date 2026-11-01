import { Pixelify_Sans, Press_Start_2P } from "next/font/google";

// Road to Glory's pixel type: Press Start 2P for titles and numbers (like an
// old console), Pixelify Sans for anything longer, which reads more easily.
export const pressStart = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-press-start", display: "swap" });
export const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", display: "swap" });
