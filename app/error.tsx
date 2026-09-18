"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h1 className="font-serif text-xl text-zinc-100 mb-2">Something Went Wrong</h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          Our custody desk has been notified. Please try again, or return to your portfolio.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-sm font-medium px-4 py-2.5 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-gold transition border border-zinc-800/60 rounded-lg px-4 py-2.5"
          >
            Back to Portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
