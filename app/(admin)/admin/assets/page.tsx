import { prisma } from "@/lib/prisma";
import AssetManagement from "@/components/AssetManagement";

export default async function AdminAssetsPage() {
  const assets = await prisma.asset.findMany({
    include: { networkAddresses: true },
    orderBy: { symbol: "asc" },
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Asset Configuration</p>
        <h1 className="font-serif text-2xl text-zinc-50">Assets &amp; Receiving Addresses</h1>
      </div>
      <AssetManagement assets={assets} />
    </div>
  );
}
