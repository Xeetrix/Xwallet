import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "XWallet Asia | Private Wealth & Digital Asset Custody",
  description:
    "An invite-only private wealth and digital asset custodial ledger for exclusive VIP clients.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-obsidian text-zinc-100 font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}
