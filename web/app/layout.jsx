import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata = {
  title: "VANTA — Instruments of night",
  description:
    "Vanta One. Machined from a single block of titanium-ceramic, calibrated for the dark.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="bg-graphite text-bone font-grotesk antialiased">
        {children}
      </body>
    </html>
  );
}
