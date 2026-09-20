"use client";

import { useId } from "react";

// The XWallet Asia monogram: a gold "X" cut into a dark rounded badge,
// reused everywhere the wordmark appears (auth/client/admin headers, mobile
// nav) plus mirrored as plain CSS in the email templates, which can't render
// arbitrary SVG reliably across clients. Several instances render on the
// same page at once (desktop sidebar + mobile header + mobile drawer are
// all in the DOM regardless of which is visible), so the gradient needs a
// per-instance id — a shared literal id here breaks the gradient reference
// on every instance after the first.
export function BrandMark({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#111420" stroke={`url(#${gradientId})`} strokeWidth="1.5" />
      <path d="M13 13L27 27M27 13L13 27" stroke={`url(#${gradientId})`} strokeWidth="2.75" strokeLinecap="round" />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E5C06E" />
          <stop offset="1" stopColor="#A8862A" />
        </linearGradient>
      </defs>
    </svg>
  );
}
