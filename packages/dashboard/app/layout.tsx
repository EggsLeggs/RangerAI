import type { Metadata } from "next";
import { Caveat, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "RangerAI Dashboard",
  description: "RangerAI monitoring dashboard"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${caveat.variable}`}>
      <body className="min-h-screen bg-forest text-cream font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
