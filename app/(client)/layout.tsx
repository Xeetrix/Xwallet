import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutUser } from "@/actions/auth-actions";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "CLIENT" || session.status !== "ACTIVE") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-line bg-panel/60 px-5 py-6">
        <div className="mb-10">
          <span className="text-gold text-[10px] tracking-[0.35em] uppercase">Private Wealth</span>
          <h1 className="font-serif text-lg text-zinc-50">XWallet Asia</h1>
        </div>
        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-2.5 rounded-lg bg-gold/10 border border-gold/20 text-gold px-3 py-2.5 text-sm">
            <LayoutDashboard className="w-4 h-4" />
            Portfolio
          </div>
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
