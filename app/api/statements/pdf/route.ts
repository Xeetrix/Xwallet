import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatementDocument, type StatementRow } from "@/lib/statement-pdf";

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
  const toInclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.sub }, select: { fullName: true, email: true } }),
    prisma.transaction.findMany({
      where: { userId: session.sub, createdAt: { gte: from, lte: toInclusive } },
      include: { asset: true, feeAsset: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows: StatementRow[] = transactions.map((t) => ({
    date: t.createdAt.toISOString().slice(0, 10),
    type: t.type.replace(/_/g, " "),
    asset: t.asset.symbol,
    amount: Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 8 }),
    fee: t.feeAmount
      ? `${Number(t.feeAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${t.feeAsset?.symbol ?? ""}`
      : "—",
    status: t.status,
    reference: t.referenceNote ?? t.counterpartyEmail ?? "—",
  }));

  const pdfBuffer = await renderToBuffer(
    StatementDocument({
      clientName: user?.fullName ?? session.fullName,
      clientEmail: user?.email ?? session.email,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      rows,
    })
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="xwallet-statement-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
