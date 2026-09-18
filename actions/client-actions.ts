"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getNetworkGasFee, SWAP_FEE_RATE } from "@/lib/fees";
import { fetchUsdPrices } from "@/lib/pricing";

export interface DepositActionState {
  error: string | null;
  success: boolean;
}

class InsufficientBalanceError extends Error {}

export async function submitDeposit(
  _prevState: DepositActionState,
  formData: FormData
): Promise<DepositActionState> {
  const session = await requireSession();

  if (session.role !== "CLIENT" || session.status !== "ACTIVE") {
    return { error: "You must be an active client to submit a deposit.", success: false };
  }

  const assetId = String(formData.get("assetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const txHash = String(formData.get("txHash") ?? "").trim();

  const amount = Number(amountRaw);

  if (!assetId || !networkName || !txHash) {
    return { error: "All fields are required.", success: false };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid deposit amount.", success: false };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.isActive) {
    return { error: "Selected asset is not available.", success: false };
  }

  await prisma.transaction.create({
    data: {
      userId: session.sub,
      assetId,
      networkName,
      type: "DEPOSIT",
      amount,
      txHash,
      status: "PENDING",
    },
  });

  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export interface TransferActionState {
  error: string | null;
  success: boolean;
}

export async function transferAsset(
  _prevState: TransferActionState,
  formData: FormData
): Promise<TransferActionState> {
  const session = await requireSession();

  if (session.role !== "CLIENT" || session.status !== "ACTIVE") {
    return { error: "You must be an active client to transfer funds.", success: false };
  }

  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();
  const assetId = String(formData.get("assetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);

  if (!recipientEmail || !assetId || !networkName) {
    return { error: "All fields are required.", success: false };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid transfer amount.", success: false };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.isActive) {
    return { error: "Selected asset is not available.", success: false };
  }

  if (recipientEmail === session.email.toLowerCase()) {
    return { error: "You cannot transfer funds to yourself.", success: false };
  }

  const recipient = await prisma.user.findUnique({ where: { email: recipientEmail } });
  if (!recipient) {
    return { error: "No client found with that email address.", success: false };
  }
  if (recipient.role !== "CLIENT" || recipient.status !== "ACTIVE") {
    return { error: "Recipient account is not active.", success: false };
  }

  const gasFee = getNetworkGasFee(asset.symbol, networkName);
  const totalDebit = amount + gasFee;

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic conditional update: only debits if the balance still covers
      // amount + fee at the moment of the write, closing the same
      // check-then-act race as the admin balance-adjustment actions.
      const debited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId, balance: { gte: totalDebit } },
        data: { balance: { decrement: totalDebit } },
      });
      if (debited.count === 0) {
        throw new InsufficientBalanceError();
      }

      await tx.userBalance.upsert({
        where: { userId_assetId: { userId: recipient.id, assetId } },
        create: { userId: recipient.id, assetId, balance: amount },
        update: { balance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId: session.sub,
          assetId,
          networkName,
          type: "TRANSFER_SENT",
          amount: totalDebit,
          feeAmount: gasFee,
          counterpartyEmail: recipient.email,
          status: "APPROVED",
          referenceNote: `Sent ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset.symbol} to ${recipient.email} — includes ${gasFee} ${asset.symbol} network fee (${networkName})`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: recipient.id,
          assetId,
          networkName,
          type: "TRANSFER_RECEIVED",
          amount,
          counterpartyEmail: session.email,
          status: "APPROVED",
          referenceNote: `Received ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset.symbol} from ${session.email}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return {
        error: `Insufficient balance. This transfer requires ${totalDebit.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset.symbol} (${amount} amount + ${gasFee} network fee).`,
        success: false,
      };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export interface SwapQuote {
  rate: number;
  grossReceive: number;
  feeAmount: number;
  netReceive: number;
  feeRate: number;
}

export async function getSwapQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: number
): Promise<SwapQuote | { error: string }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (fromSymbol.toUpperCase() === toSymbol.toUpperCase()) {
    return { error: "Select two different assets." };
  }

  const prices = await fetchUsdPrices([fromSymbol, toSymbol]);
  const fromPrice = prices[fromSymbol.toUpperCase()];
  const toPrice = prices[toSymbol.toUpperCase()];

  if (!fromPrice || !toPrice) {
    return { error: "Live pricing is unavailable for this pair right now." };
  }

  const rate = fromPrice / toPrice;
  const grossReceive = amount * rate;
  const feeAmount = grossReceive * SWAP_FEE_RATE;
  const netReceive = grossReceive - feeAmount;

  return { rate, grossReceive, feeAmount, netReceive, feeRate: SWAP_FEE_RATE };
}

export interface SwapActionState {
  error: string | null;
  success: boolean;
}

export async function convertAsset(
  _prevState: SwapActionState,
  formData: FormData
): Promise<SwapActionState> {
  const session = await requireSession();

  if (session.role !== "CLIENT" || session.status !== "ACTIVE") {
    return { error: "You must be an active client to convert funds.", success: false };
  }

  const fromAssetId = String(formData.get("fromAssetId") ?? "");
  const toAssetId = String(formData.get("toAssetId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);

  if (!fromAssetId || !toAssetId || fromAssetId === toAssetId) {
    return { error: "Select two different assets.", success: false };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount.", success: false };
  }

  const [fromAsset, toAsset] = await Promise.all([
    prisma.asset.findUnique({ where: { id: fromAssetId } }),
    prisma.asset.findUnique({ where: { id: toAssetId } }),
  ]);
  if (!fromAsset?.isActive || !toAsset?.isActive) {
    return { error: "Selected asset is not available.", success: false };
  }

  const quote = await getSwapQuote(fromAsset.symbol, toAsset.symbol, amount);
  if ("error" in quote) {
    return { error: quote.error, success: false };
  }
  const { rate, feeAmount, netReceive, feeRate } = quote;

  try {
    await prisma.$transaction(async (tx) => {
      const debited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId: fromAssetId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new InsufficientBalanceError();
      }

      await tx.userBalance.upsert({
        where: { userId_assetId: { userId: session.sub, assetId: toAssetId } },
        create: { userId: session.sub, assetId: toAssetId, balance: netReceive },
        update: { balance: { increment: netReceive } },
      });

      const rateNote = `1 ${fromAsset.symbol} ≈ ${rate.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toAsset.symbol} (platform fee ${(feeRate * 100).toFixed(2)}%)`;

      await tx.transaction.create({
        data: {
          userId: session.sub,
          assetId: fromAssetId,
          type: "SWAP_DEBIT",
          amount,
          status: "APPROVED",
          referenceNote: `Converted ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${fromAsset.symbol} → ${netReceive.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toAsset.symbol} at ${rateNote}`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: session.sub,
          assetId: toAssetId,
          type: "SWAP_CREDIT",
          amount: netReceive,
          feeAmount,
          status: "APPROVED",
          referenceNote: `Received from converting ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${fromAsset.symbol} at ${rateNote}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { error: `Insufficient ${fromAsset.symbol} balance.`, success: false };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  return { error: null, success: true };
}
