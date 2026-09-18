"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CopyTag({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={value}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1 font-mono text-xs text-zinc-400 transition-all hover:-translate-y-px hover:border-gold/40 hover:text-gold hover:shadow-[0_0_0_1px_rgba(212,175,55,0.15)]",
        className
      )}
    >
      <span className="truncate max-w-[10rem] sm:max-w-[16rem]">{label ?? value}</span>
      {copied ? (
        <Check className="w-3 h-3 shrink-0 text-emerald" />
      ) : (
        <Copy className="w-3 h-3 shrink-0 opacity-50 transition group-hover:opacity-100" />
      )}
    </button>
  );
}
