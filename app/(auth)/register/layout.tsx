import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request Access",
  description:
    "Request invite-only access to XWallet Asia's private wealth and digital asset custody platform.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
