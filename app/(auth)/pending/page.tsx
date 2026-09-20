import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutUser } from "@/actions/auth-actions";

export const metadata: Metadata = {
  title: "Application Received",
  robots: { index: false, follow: false },
};

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-5">
        <MailCheck className="w-6 h-6 text-gold" />
      </div>
      <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1.5">Application Received</p>
      <h2 className="font-serif text-xl text-zinc-100 mb-2">
        Thank You, {session.fullName.split(" ")[0]}!
      </h2>
      <p className="text-sm text-zinc-500 leading-relaxed mb-6">
        Your XWallet Asia account has been created. We&apos;ve sent a confirmation link to your email
        address — click it to activate your account immediately. If it doesn&apos;t arrive, our private
        wealth desk will review your application manually.
      </p>
      <form action={logoutUser}>
        <button
          type="submit"
          className="text-sm text-zinc-400 hover:text-gold transition border border-zinc-800/60 rounded-lg px-4 py-2"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
