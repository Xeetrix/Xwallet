"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coins,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

// Icon components can't cross the server->client boundary as props (React
// Server Components only serialize plain data), so each variant's nav items
// — icons included — are defined here, inside the client component, rather
// than passed in from the server-rendered layout.
const NAV_SETS: Record<"client" | "admin", NavItem[]> = {
  client: [{ href: "/dashboard", label: "Portfolio", icon: LayoutDashboard, exact: true }],
  admin: [
    { href: "/admin", label: "Console", icon: LayoutGrid, exact: true },
    { href: "/admin/transactions", label: "Transactions", icon: ScrollText, exact: false },
    { href: "/admin/assets", label: "Assets", icon: Coins, exact: false },
  ],
};

export default function MobileNav({
  variant,
  eyebrow,
  userLabel,
  logoutAction,
}: {
  variant: "client" | "admin";
  eyebrow: string;
  userLabel: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = NAV_SETS[variant];

  // Close the drawer automatically on route change and lock body scroll
  // while it's open, matching standard mobile-drawer behavior.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl px-4 py-3.5">
        <div>
          <span className="text-gold text-[9px] tracking-[0.3em] uppercase block leading-none mb-1">
            {eyebrow}
          </span>
          <span className="font-serif text-base text-zinc-50 leading-none">XWallet Asia</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 text-zinc-300 hover:text-gold transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs bg-zinc-950 border-l border-zinc-800/60 p-5 flex flex-col animate-slide-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-gold text-[9px] tracking-[0.3em] uppercase block leading-none mb-1">
                  {eyebrow}
                </span>
                <span className="font-serif text-base text-zinc-50 leading-none">XWallet Asia</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 text-zinc-400 hover:text-zinc-100 transition"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {navItems.map(({ href, label, icon: Icon, exact }) => {
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

            <div className="border-t border-zinc-800/60 pt-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
                {userLabel}
              </div>
              <form action={logoutAction}>
                <button className="flex items-center gap-2 text-sm text-zinc-400 hover:text-gold transition">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
