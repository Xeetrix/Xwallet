import { AlertTriangle, CheckCircle2, Scale, ShieldAlert, Vault } from "lucide-react";
import { computeReserveSummary, reconcileLedger } from "@/lib/ledger";
import CryptoIcon from "@/components/CryptoIcon";
import StatCard from "@/components/StatCard";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 8 });

export default async function AdminReservesPage() {
  const [summary, discrepancies] = await Promise.all([computeReserveSummary(), reconcileLedger()]);

  const deficitCount = summary.filter((s) => s.deficit).length;
  const fullyCoveredCount = summary.filter((s) => !s.deficit && s.liabilities > 0).length;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Solvency</p>
        <h1 className="font-serif text-2xl text-zinc-50">Proof of Reserves</h1>
        <p className="text-sm text-zinc-500 mt-1.5 max-w-2xl">
          Client liabilities are the live sum of every client balance. Reserves are the balances admins have
          recorded for active custody vaults on the Assets page — update them there to keep this accurate.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Assets Tracked"
          value={summary.length}
          icon={Vault}
          tone="gold"
        />
        <StatCard
          label="Fully Covered"
          value={fullyCoveredCount}
          icon={CheckCircle2}
          tone="emerald"
          valueTone="emerald"
        />
        <StatCard
          label="Coverage Deficits"
          value={deficitCount}
          icon={ShieldAlert}
          tone={deficitCount > 0 ? "gold" : "zinc"}
          valueTone={deficitCount > 0 ? "gold" : "zinc"}
        />
      </div>

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5 flex items-center gap-2">
          <Scale className="w-4 h-4 text-gold" />
          Solvency by Asset
        </h2>
        {summary.length === 0 ? (
          <p className="text-sm text-zinc-500">No client balances or vault reserves recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {summary.map((s) => (
              <div
                key={s.assetSymbol}
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5 gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CryptoIcon symbol={s.assetSymbol} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100">{s.assetSymbol}</p>
                    <p className="text-xs text-zinc-500 font-mono">
                      Liabilities {fmt(s.liabilities)} · Reserves {fmt(s.reserves)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={
                      s.deficit
                        ? "font-serif text-lg text-red-400"
                        : "font-serif text-lg text-emerald"
                    }
                  >
                    {s.solvencyRatioPct === null ? "—" : `${s.solvencyRatioPct.toFixed(1)}%`}
                  </p>
                  {s.deficit && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1 justify-end">
                      <AlertTriangle className="w-3 h-3" />
                      Deficit
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <h2 className="font-serif text-lg text-zinc-100 mb-5 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gold" />
          Ledger Reconciliation
        </h2>
        {discrepancies.length === 0 ? (
          <p className="text-sm text-emerald flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Every client balance matches its double-entry ledger exactly.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-400">
              {discrepancies.length} balance{discrepancies.length === 1 ? "" : "s"} do not match the ledger —
              investigate before trusting the totals above.
            </p>
            {discrepancies.map((d) => (
              <div
                key={`${d.accountId}-${d.assetSymbol}`}
                className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-zinc-300"
              >
                <p className="text-zinc-100">
                  {d.accountLabel} · {d.assetSymbol}
                </p>
                <p className="font-mono text-zinc-500 mt-1">
                  Balance {fmt(d.balanceAmount)} vs Ledger {fmt(d.ledgerAmount)} (diff {fmt(d.difference)})
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
