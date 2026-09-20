import { NextRequest, NextResponse } from "next/server";
import type { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const assetId = searchParams.get("assetId");
  const assetSymbol = searchParams.get("asset");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const where: Prisma.TransactionWhereInput = {};
  if (userId) where.userId = userId;
  if (assetId) where.assetId = assetId;
  if (assetSymbol) where.asset = { symbol: assetSymbol.toUpperCase() };
  if (type) where.type = type as TransactionType;
  if (status) where.status = status as TransactionStatus;
  if (q) {
    where.user = {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  if (fromParam || toParam) {
    where.createdAt = {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(new Date(toParam).getTime() + 24 * 60 * 60 * 1000 - 1) } : {}),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { user: true, asset: true, feeAsset: true },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const rows = transactions.map((t) => [
    t.createdAt.toISOString(),
    t.user.email,
    t.type,
    t.asset.symbol,
    Number(t.amount).toFixed(8),
    t.feeAmount ? Number(t.feeAmount).toFixed(8) : "",
    t.feeAsset?.symbol ?? "",
    t.counterpartyEmail ?? "",
    t.destinationAddress ?? "",
    t.txHash ?? "",
    t.status,
    t.referenceNote ?? "",
  ]);

  const csv = toCsv(
    [
      "Date",
      "Client Email",
      "Type",
      "Asset",
      "Amount",
      "Fee",
      "Fee Asset",
      "Counterparty",
      "Destination",
      "Transaction Hash",
      "Status",
      "Reference",
    ],
    rows
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="xwallet-master-ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
