"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Console", icon: LayoutGrid, exact: true },
  { href: "/admin/assets", label: "Assets", icon: Coins, exact: false },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition",
              active
                ? "bg-gold/10 border border-gold/20 text-gold"
                : "border border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
