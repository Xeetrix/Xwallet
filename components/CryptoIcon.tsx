"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ICON_CDN = "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color";

export default function CryptoIcon({
  symbol,
  size = 32,
  className,
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const normalized = symbol.trim().toLowerCase();

  if (errored || !normalized) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "shrink-0 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-medium",
          className
        )}
      >
        <span style={{ fontSize: Math.max(9, size * 0.32) }}>{symbol.slice(0, 3).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <Image
      src={`${ICON_CDN}/${normalized}.svg`}
      alt={symbol}
      width={size}
      height={size}
      unoptimized
      onError={() => setErrored(true)}
      className={cn("shrink-0 rounded-full", className)}
    />
  );
}
