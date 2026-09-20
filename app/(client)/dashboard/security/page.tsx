import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TwoFactorSetup from "@/components/TwoFactorSetup";

export const metadata: Metadata = {
  title: "Security Settings",
  robots: { index: false, follow: false },
};

export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT" || session.status !== "ACTIVE") {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { totpEnabled: true },
  });

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Account</p>
      <h1 className="font-serif text-2xl text-zinc-50 mb-8">Security Settings</h1>

      <div className="luxury-card p-6">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Two-Factor Authentication</h2>
        <TwoFactorSetup enabled={user?.totpEnabled ?? false} />
      </div>
    </div>
  );
}
