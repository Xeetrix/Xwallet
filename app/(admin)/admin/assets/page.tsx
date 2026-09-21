import { prisma } from "@/lib/prisma";
import AssetManagement from "@/components/AssetManagement";
import CustodyVaultManagement from "@/components/CustodyVaultManagement";

export default async function AdminAssetsPage() {
  const [assets, vaults] = await Promise.all([
    prisma.asset.findMany({
      include: { networkAddresses: true },
      orderBy: { symbol: "asc" },
    }),
    prisma.custodyVault.findMany({
      include: { reserves: { include: { asset: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12">
      <div>
        <div className="mb-8">
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Asset Configuration</p>
          <h1 className="font-serif text-2xl text-zinc-50">Assets &amp; Receiving Addresses</h1>
        </div>
        <AssetManagement assets={assets} />
      </div>

      <div>
        <div className="mb-8">
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Institutional Custody</p>
          <h1 className="font-serif text-2xl text-zinc-50">Custody Vaults</h1>
        </div>
        <CustodyVaultManagement vaults={vaults} assets={assets} />
      </div>
    </div>
  );
}
