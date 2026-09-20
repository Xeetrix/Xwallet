import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Two-Factor Verification",
  robots: { index: false, follow: false },
};

export default function Verify2FALayout({ children }: { children: React.ReactNode }) {
  return children;
}
