import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutUser } from "@/actions/auth-actions";
import AdminNav from "@/components/AdminNav";
import MobileNav from "@/components/MobileNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <MobileNav
        variant="admin"
        eyebrow="Master Console"
        userLabel={session.fullName}
        logoutAction={logoutUser}
      />

      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800/60 bg-zinc-950/40 backdrop-blur-xl px-5 py-6">
        <div className="mb-10">
          <span className="text-gold text-[10px] tracking-[0.35em] uppercase">Master Console</span>
          <h1 className="font-serif text-lg text-zinc-50">XWallet Asia</h1>
        </div>
        <AdminNav />
        <div className="border-t border-zinc-800/60 pt-4 mt-4">
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
