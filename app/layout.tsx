import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ensureMasterAdmin, ensureDefaultAssets } from "@/lib/bootstrap";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE_URL = "https://xwallet.asia";
const DESCRIPTION =
  "An invite-only private wealth and digital asset custodial ledger for exclusive VIP clients.";

// Indexing defaults to on here (for the public login/register pages) and is
// overridden to noindex on every authenticated section (dashboard, admin,
// pending, verify-email) — those pages have nothing for a search engine to
// usefully index and should never be cached or surfaced in results.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "XWallet Asia | Private Wealth & Digital Asset Custody",
    template: "%s — XWallet Asia",
  },
  description: DESCRIPTION,
  keywords: [
    "XWallet Asia",
    "private wealth custody",
    "digital asset custody",
    "crypto custodial ledger",
    "invite-only wealth platform",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "XWallet Asia",
    title: "XWallet Asia | Private Wealth & Digital Asset Custody",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "XWallet Asia | Private Wealth & Digital Asset Custody",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#090A10",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureMasterAdmin();
  await ensureDefaultAssets();

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="relative bg-gradient-to-b from-[#0B0D14] via-[#08090E] to-[#040507] text-zinc-100 font-sans antialiased min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(212,175,55,0.07),transparent_55%)]" />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
