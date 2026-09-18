import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-5">
          <Compass className="w-6 h-6 text-gold" />
        </div>
        <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-2">404</p>
        <h1 className="font-serif text-xl text-zinc-100 mb-2">Page Not Found</h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          This address doesn&apos;t exist within your private ledger.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-sm font-medium px-4 py-2.5 transition"
        >
          Back to Portfolio
        </Link>
      </div>
    </div>
  );
}
