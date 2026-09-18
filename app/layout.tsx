import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ensureMasterAdmin } from "@/lib/bootstrap";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "XWallet Asia | Private Wealth & Digital Asset Custody",
  description:
    "An invite-only private wealth and digital asset custodial ledger for exclusive VIP clients.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureMasterAdmin();

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="relative bg-gradient-to-b from-[#0B0D14] via-[#08090E] to-[#040507] text-zinc-100 font-sans antialiased min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(212,175,55,0.07),transparent_55%)]" />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
