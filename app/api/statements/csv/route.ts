import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

const DEFAULT_RANGE_DAYS = 90;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  // Include the entire "to" calendar day.
  const toInclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.sub, createdAt: { gte: from, lte: toInclusive } },
    include: { asset: true, feeAsset: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = transactions.map((t) => [
    t.createdAt.toISOString(),
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
      "Content-Disposition": `attachment; filename="xwallet-statement-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
