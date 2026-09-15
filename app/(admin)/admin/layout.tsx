import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Coins, LogOut, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutUser } from "@/actions/auth-actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-line bg-panel/60 px-5 py-6">
        <div className="mb-10">
          <span className="text-gold text-[10px] tracking-[0.35em] uppercase">Master Console</span>
          <h1 className="font-serif text-lg text-zinc-50">XWallet Asia</h1>
        </div>
        <nav className="flex-1 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-panel hover:text-gold transition"
          >
            <LayoutGrid className="w-4 h-4" />
            Console
          </Link>
          <Link
            href="/admin/assets"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-panel hover:text-gold transition"
          >
            <Coins className="w-4 h-4" />
            Assets
          </Link>
        </nav>
        <div className="border-t border-line pt-4 mt-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
            {session.fullName}
          </div>
          <form action={logoutUser}>
            <button className="flex items-center gap-2 text-sm text-zinc-400 hover:text-gold transition">
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
