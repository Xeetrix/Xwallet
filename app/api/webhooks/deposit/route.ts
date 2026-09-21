import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { sendTransactionEmail } from "@/lib/email";
import { writeLedgerEntries, SYSTEM_RESERVE_ACCOUNT } from "@/lib/ledger";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 8 });

/**
 * Normalized shape this route expects the incoming webhook body to already
 * be in. A real Alchemy "Address Activity" or Moralis Stream payload has
 * its own shape and would need a small adapter in front of this — that
 * adapter is deliberately not written here, since without live provider
 * credentials there's nothing to validate it against. This route is the
 * part that's provider-agnostic: signature verification, matching, and
 * the auto-approve / unattributed-queue decision.
 */
interface DepositWebhookPayload {
  txHash: string;
  toAddress: string;
  assetSymbol: string;
  networkName: string;
  amount: number;
}

function isValidPayload(body: unknown): body is DepositWebhookPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.txHash === "string" &&
    b.txHash.length > 0 &&
    typeof b.toAddress === "string" &&
    typeof b.assetSymbol === "string" &&
    typeof b.networkName === "string" &&
    typeof b.amount === "number" &&
    Number.isFinite(b.amount) &&
    b.amount > 0
  );
}

/**
 * Verifies an HMAC-SHA256 signature over the raw request body against
 * WEBHOOK_SIGNING_SECRET. This is a generic placeholder — Alchemy and
 * Moralis each use their own signing schemes (different header name, and
 * Alchemy signs with a provider-issued signing key rather than a shared
 * secret you choose), so swap this for the provider's documented scheme
 * before pointing a real webhook at this route. Fails closed: no secret
 * configured means no requests are accepted, never that verification is
 * skipped.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // Idempotent: a webhook that fires twice for the same on-chain event
  // must never credit twice. txHash is unique across both Transaction and
  // UnattributedDeposit, so a replay always either finds the same
  // already-processed row here or gets rejected by the DB below.
  const existingTransaction = await prisma.transaction.findUnique({ where: { txHash: body.txHash } });
  if (existingTransaction) {
    if (existingTransaction.status !== "PENDING") {
      return NextResponse.json({ status: "already-processed" }, { status: 200 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: existingTransaction.id },
      include: { user: true, asset: true },
    });
    if (!transaction) {
      return NextResponse.json({ status: "already-processed" }, { status: 200 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.updateMany({
          where: { id: transaction.id, status: "PENDING" },
          data: { status: "APPROVED" },
        });
        if (updated.count === 0) return; // raced with an admin review — fine either way

        await tx.userBalance.upsert({
          where: { userId_assetId: { userId: transaction.userId, assetId: transaction.assetId } },
          create: { userId: transaction.userId, assetId: transaction.assetId, balance: transaction.amount },
          update: { balance: { increment: transaction.amount } },
        });

        await writeLedgerEntries(tx, transaction.id, [
          { accountId: transaction.userId, assetId: transaction.assetId, direction: "CREDIT", amount: transaction.amount },
          { accountId: SYSTEM_RESERVE_ACCOUNT, assetId: transaction.assetId, direction: "DEBIT", amount: transaction.amount },
        ]);
      });
    } catch (error) {
      console.error("[webhook/deposit] Failed to auto-approve matched deposit:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    await writeAuditLog({
      actorId: "SYSTEM_WEBHOOK",
      action: "DEPOSIT_AUTO_APPROVED",
      targetType: "Transaction",
      targetId: transaction.id,
      metadata: { txHash: body.txHash, amount: transaction.amount.toString() },
    });

    await sendTransactionEmail({
      to: transaction.user.email,
      fullName: transaction.user.fullName,
      subject: "Deposit approved",
      headline: "Deposit approved",
      intro: "Your deposit has been verified on-chain and credited to your account.",
      accent: "emerald",
      rows: [
        { label: "Asset", value: transaction.asset.symbol },
        { label: "Amount", value: `${fmt(Number(transaction.amount))} ${transaction.asset.symbol}` },
        { label: "Status", value: "APPROVED" },
      ],
    });

    return NextResponse.json({ status: "auto-approved" }, { status: 200 });
  }

  // No client-submitted deposit matches this txHash — queue it for an
  // admin to assign to the correct client rather than guessing.
  const networkAddress = await prisma.networkAddress.findFirst({
    where: { walletAddress: body.toAddress, isActive: true },
    include: { asset: true },
  });
  if (!networkAddress) {
    return NextResponse.json({ error: "Destination address not recognized" }, { status: 422 });
  }

  try {
    await prisma.unattributedDeposit.create({
      data: {
        assetId: networkAddress.assetId,
        networkName: body.networkName,
        walletAddress: body.toAddress,
        amount: body.amount,
        txHash: body.txHash,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ status: "already-queued" }, { status: 200 });
    }
    throw error;
  }

  await writeAuditLog({
    actorId: "SYSTEM_WEBHOOK",
    action: "UNATTRIBUTED_DEPOSIT_QUEUED",
    targetType: "UnattributedDeposit",
    metadata: { txHash: body.txHash, assetSymbol: networkAddress.asset.symbol, amount: body.amount },
  });

  return NextResponse.json({ status: "queued-unattributed" }, { status: 200 });
}
