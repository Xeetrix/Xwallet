import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your XWallet Asia private wealth and digital asset custody account.",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "XWallet Asia",
  url: "https://xwallet.asia",
  logo: "https://xwallet.asia/icon",
  description: "Invite-only private wealth and digital asset custody platform.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {children}
    </>
  );
}
