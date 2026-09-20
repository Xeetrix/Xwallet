import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <BrandMark className="w-12 h-12 mx-auto mb-4" />
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-px w-8 bg-gold/60" />
            <span className="text-gold text-xs tracking-[0.35em] uppercase">Private Wealth</span>
            <span className="h-px w-8 bg-gold/60" />
          </div>
          <h1 className="font-serif text-3xl text-zinc-50 tracking-wide">XWallet Asia</h1>
        </div>
        <div className="luxury-card p-8 shadow-2xl shadow-black/40">{children}</div>
        <p className="mt-6 text-center text-xs text-zinc-600 tracking-wide">
          Invite-only digital asset custody. By continuing you agree to the confidentiality of this
          portal.
        </p>
      </div>
    </div>
  );
}
