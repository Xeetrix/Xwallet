"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFreshClientSession } from "@/lib/auth";
import { computeNetworkFee, TRANSFER_FEE_RATE, WITHDRAWAL_FEE_RATE, CONVERT_FEE_RATE } from "@/lib/fees";
import { fetchUsdPrices } from "@/lib/pricing";
import { sendTransactionEmail } from "@/lib/email";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 8 });

export interface DepositActionState {
  error: string | null;
  success: boolean;
}

class InsufficientBalanceError extends Error {}
class InsufficientGasAssetError extends Error {
  constructor(public gasAssetSymbol: string) {
    super(`Insufficient ${gasAssetSymbol} balance for network fee.`);
  }
}

export interface NetworkFeeQuoteResult {
  gasAssetSymbol: string;
  feeInGasAsset: number;
  feeRate: number;
}

/**
 * Live fee preview for the Transfer/Withdraw/Convert modals — lets the UI
 * show "X TRX network fee" before the client submits, without duplicating
 * the pricing/network lookup logic client-side.
 */
export async function getNetworkFeeQuote(
  assetSymbol: string,
  networkName: string,
  amount: number,
  kind: "TRANSFER" | "WITHDRAWAL" | "CONVERT"
): Promise<NetworkFeeQuoteResult | { error: string }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }
  const feeRate =
    kind === "WITHDRAWAL" ? WITHDRAWAL_FEE_RATE : kind === "TRANSFER" ? TRANSFER_FEE_RATE : CONVERT_FEE_RATE;
  const result = await computeNetworkFee(amount, assetSymbol, networkName, feeRate);
  if ("error" in result) return result;
  return { ...result, feeRate };
}

export async function submitDeposit(
  _prevState: DepositActionState,
  formData: FormData
): Promise<DepositActionState> {
  const session = await requireFreshClientSession();

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

  // Rejects the same on-chain deposit being submitted twice — under any
  // status, not just PENDING/APPROVED, since even a REJECTED row proves
  // this exact hash was already reviewed once. The DB-level unique
  // constraint on Transaction.txHash is the hard backstop for the race
  // between this check and the create below; P2002 there is treated the
  // same as failing this check up front.
  const existingDeposit = await prisma.transaction.findUnique({ where: { txHash } });
  if (existingDeposit) {
    return { error: "This transaction hash has already been submitted.", success: false };
  }

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This transaction hash has already been submitted.", success: false };
    }
    throw error;
  }

  await sendTransactionEmail({
    to: session.email,
    fullName: session.fullName,
    subject: "Deposit received — pending review",
    headline: "Deposit submitted",
    intro: "We've received your deposit and it's now pending review by our custody desk.",
    accent: "gold",
    rows: [
      { label: "Asset", value: asset.symbol },
      { label: "Network", value: networkName },
      { label: "Amount", value: `${fmt(amount)} ${asset.symbol}` },
      { label: "Transaction Hash", value: txHash },
      { label: "Status", value: "Pending" },
    ],
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
  const session = await requireFreshClientSession();

  if (session.role !== "CLIENT" || session.status !== "ACTIVE") {
    return { error: "You must be an active client to transfer funds.", success: false };
  }

  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();
  const assetId = String(formData.get("assetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim().toUpperCase();
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

  const feeQuote = await computeNetworkFee(amount, asset.symbol, networkName, TRANSFER_FEE_RATE);
  if ("error" in feeQuote) {
    return { error: feeQuote.error, success: false };
  }
  const { gasAssetSymbol, feeInGasAsset } = feeQuote;

  const gasAsset = await prisma.asset.findUnique({ where: { symbol: gasAssetSymbol } });
  if (!gasAsset || !gasAsset.isActive) {
    return {
      error: `${gasAssetSymbol} is required to pay the ${networkName} network fee but isn't available on this platform.`,
      success: false,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic conditional update: only debits if the balance still covers
      // the amount at the moment of the write, closing the same
      // check-then-act race as the admin balance-adjustment actions.
      const debited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new InsufficientBalanceError();
      }

      // The network fee comes out of a separate balance — the chain's
      // native gas asset — never the asset being transferred, mirroring
      // real on-chain gas. This conditional update runs after the one
      // above inside the same transaction, so when the gas asset and the
      // transferred asset are the same, it correctly sees the
      // already-reduced balance and requires the combined total.
      const feeDebited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId: gasAsset.id, balance: { gte: feeInGasAsset } },
        data: { balance: { decrement: feeInGasAsset } },
      });
      if (feeDebited.count === 0) {
        throw new InsufficientGasAssetError(gasAssetSymbol);
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
          amount,
          feeAmount: feeInGasAsset,
          feeAssetId: gasAsset.id,
          counterpartyEmail: recipient.email,
          status: "APPROVED",
          referenceNote: `Sent ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset.symbol} to ${recipient.email} via ${networkName} — network fee ${feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${gasAssetSymbol}`,
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
        error: `Insufficient ${asset.symbol} balance for this transfer.`,
        success: false,
      };
    }
    if (error instanceof InsufficientGasAssetError) {
      return {
        error: `Insufficient ${gasAssetSymbol} balance to cover the ${networkName} network fee (${feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${gasAssetSymbol} required).`,
        success: false,
      };
    }
    throw error;
  }

  await Promise.all([
    sendTransactionEmail({
      to: session.email,
      fullName: session.fullName,
      subject: `You sent ${fmt(amount)} ${asset.symbol}`,
      headline: "Transfer sent",
      intro: `Your transfer to ${recipient.email} is complete.`,
      accent: "red",
      rows: [
        { label: "Recipient", value: recipient.email },
        { label: "Amount", value: `${fmt(amount)} ${asset.symbol}` },
        { label: "Network", value: networkName },
        { label: "Network fee", value: `${fmt(feeInGasAsset)} ${gasAssetSymbol}` },
      ],
    }),
    sendTransactionEmail({
      to: recipient.email,
      fullName: recipient.fullName,
      subject: `You received ${fmt(amount)} ${asset.symbol}`,
      headline: "Transfer received",
      intro: `${session.fullName} sent you funds.`,
      accent: "emerald",
      rows: [
        { label: "From", value: session.email },
        { label: "Amount", value: `${fmt(amount)} ${asset.symbol}` },
        { label: "Network", value: networkName },
      ],
    }),
  ]);

  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export interface WithdrawActionState {
  error: string | null;
  success: boolean;
}

export async function requestWithdrawal(
  _prevState: WithdrawActionState,
  formData: FormData
): Promise<WithdrawActionState> {
  const session = await requireFreshClientSession();

  if (session.role !== "CLIENT" || session.status !== "ACTIVE") {
    return { error: "You must be an active client to request a withdrawal.", success: false };
  }

  const assetId = String(formData.get("assetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim().toUpperCase();
  const destinationAddress = String(formData.get("destinationAddress") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);

  if (!assetId || !networkName || !destinationAddress) {
    return { error: "All fields are required.", success: false };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid withdrawal amount.", success: false };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.isActive) {
    return { error: "Selected asset is not available.", success: false };
  }

  const feeQuote = await computeNetworkFee(amount, asset.symbol, networkName, WITHDRAWAL_FEE_RATE);
  if ("error" in feeQuote) {
    return { error: feeQuote.error, success: false };
  }
  const { gasAssetSymbol, feeInGasAsset } = feeQuote;

  const gasAsset = await prisma.asset.findUnique({ where: { symbol: gasAssetSymbol } });
  if (!gasAsset || !gasAsset.isActive) {
    return {
      error: `${gasAssetSymbol} is required to pay the ${networkName} network fee but isn't available on this platform.`,
      success: false,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Reserve the funds immediately (same conditional-update pattern used
      // by transfers and swaps) so a client can't request more than one
      // withdrawal against the same balance before either is reviewed.
      const debited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new InsufficientBalanceError();
      }

      // Network fee reserved from a separate balance — the chain's native
      // gas asset — same reasoning as transfers.
      const feeDebited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId: gasAsset.id, balance: { gte: feeInGasAsset } },
        data: { balance: { decrement: feeInGasAsset } },
      });
      if (feeDebited.count === 0) {
        throw new InsufficientGasAssetError(gasAssetSymbol);
      }

      await tx.transaction.create({
        data: {
          userId: session.sub,
          assetId,
          networkName,
          type: "WITHDRAWAL",
          amount,
          feeAmount: feeInGasAsset,
          feeAssetId: gasAsset.id,
          destinationAddress,
          status: "PENDING",
          referenceNote: `Withdrawal request: ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset.symbol} to ${destinationAddress} via ${networkName} — network fee ${feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${gasAssetSymbol}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { error: `Insufficient ${asset.symbol} balance for this withdrawal.`, success: false };
    }
    if (error instanceof InsufficientGasAssetError) {
      return {
        error: `Insufficient ${gasAssetSymbol} balance to cover the ${networkName} network fee (${feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${gasAssetSymbol} required).`,
        success: false,
      };
    }
    throw error;
  }

  await sendTransactionEmail({
    to: session.email,
    fullName: session.fullName,
    subject: `Withdrawal request received — ${fmt(amount)} ${asset.symbol}`,
    headline: "Withdrawal requested",
    intro: "Your withdrawal request is pending review by our custody desk.",
    accent: "gold",
    rows: [
      { label: "Asset", value: asset.symbol },
      { label: "Amount", value: `${fmt(amount)} ${asset.symbol}` },
      { label: "Network", value: networkName },
      { label: "Destination", value: destinationAddress },
      { label: "Network fee", value: `${fmt(feeInGasAsset)} ${gasAssetSymbol}` },
      { label: "Status", value: "Pending" },
    ],
  });

  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export interface SwapQuote {
  rate: number;
  receiveAmount: number;
  gasAssetSymbol: string;
  feeInGasAsset: number;
  feeRate: number;
}

export async function getSwapQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: number,
  networkName: string
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

  const feeQuote = await computeNetworkFee(amount, fromSymbol, networkName, CONVERT_FEE_RATE);
  if ("error" in feeQuote) {
    return { error: feeQuote.error };
  }

  const rate = fromPrice / toPrice;
  const receiveAmount = amount * rate;

  return {
    rate,
    receiveAmount,
    gasAssetSymbol: feeQuote.gasAssetSymbol,
    feeInGasAsset: feeQuote.feeInGasAsset,
    feeRate: CONVERT_FEE_RATE,
  };
}

export interface SwapActionState {
  error: string | null;
  success: boolean;
}

export async function convertAsset(
  _prevState: SwapActionState,
  formData: FormData
): Promise<SwapActionState> {
  const session = await requireFreshClientSession();

  if (session.role !== "CLIENT" || session.status !== "ACTIVE") {
    return { error: "You must be an active client to convert funds.", success: false };
  }

  const fromAssetId = String(formData.get("fromAssetId") ?? "");
  const toAssetId = String(formData.get("toAssetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim().toUpperCase();
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);

  if (!fromAssetId || !toAssetId || !networkName || fromAssetId === toAssetId) {
    return { error: "Select two different assets and a network.", success: false };
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

  const quote = await getSwapQuote(fromAsset.symbol, toAsset.symbol, amount, networkName);
  if ("error" in quote) {
    return { error: quote.error, success: false };
  }
  const { rate, receiveAmount, gasAssetSymbol, feeInGasAsset, feeRate } = quote;

  const gasAsset = await prisma.asset.findUnique({ where: { symbol: gasAssetSymbol } });
  if (!gasAsset || !gasAsset.isActive) {
    return {
      error: `${gasAssetSymbol} is required to pay the ${networkName} network fee but isn't available on this platform.`,
      success: false,
    };
  }

  const rateNote = `1 ${fromAsset.symbol} ≈ ${rate.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toAsset.symbol}`;

  try {
    await prisma.$transaction(async (tx) => {
      const debited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId: fromAssetId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new InsufficientBalanceError();
      }

      // Network fee comes out of a separate balance — the chain's native
      // gas asset — never the asset being converted. Runs after the debit
      // above inside the same transaction, so when the gas asset is also
      // the "from" asset, it correctly requires the combined total.
      const feeDebited = await tx.userBalance.updateMany({
        where: { userId: session.sub, assetId: gasAsset.id, balance: { gte: feeInGasAsset } },
        data: { balance: { decrement: feeInGasAsset } },
      });
      if (feeDebited.count === 0) {
        throw new InsufficientGasAssetError(gasAssetSymbol);
      }

      await tx.userBalance.upsert({
        where: { userId_assetId: { userId: session.sub, assetId: toAssetId } },
        create: { userId: session.sub, assetId: toAssetId, balance: receiveAmount },
        update: { balance: { increment: receiveAmount } },
      });

      await tx.transaction.create({
        data: {
          userId: session.sub,
          assetId: fromAssetId,
          networkName,
          type: "SWAP_DEBIT",
          amount,
          feeAmount: feeInGasAsset,
          feeAssetId: gasAsset.id,
          status: "APPROVED",
          referenceNote: `Converted ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${fromAsset.symbol} → ${receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toAsset.symbol} at ${rateNote} — network fee ${feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${gasAssetSymbol} (${(feeRate * 100).toFixed(2)}%)`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: session.sub,
          assetId: toAssetId,
          networkName,
          type: "SWAP_CREDIT",
          amount: receiveAmount,
          status: "APPROVED",
          referenceNote: `Received from converting ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${fromAsset.symbol} at ${rateNote}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { error: `Insufficient ${fromAsset.symbol} balance.`, success: false };
    }
    if (error instanceof InsufficientGasAssetError) {
      return {
        error: `Insufficient ${gasAssetSymbol} balance to cover the ${networkName} network fee (${feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${gasAssetSymbol} required).`,
        success: false,
      };
    }
    throw error;
  }

  await sendTransactionEmail({
    to: session.email,
    fullName: session.fullName,
    subject: `Conversion complete: ${fromAsset.symbol} → ${toAsset.symbol}`,
    headline: "Conversion complete",
    intro: `Your conversion from ${fromAsset.symbol} to ${toAsset.symbol} has settled.`,
    accent: "emerald",
    rows: [
      { label: "You paid", value: `${fmt(amount)} ${fromAsset.symbol}` },
      { label: "You received", value: `${fmt(receiveAmount)} ${toAsset.symbol}` },
      { label: "Rate", value: rateNote },
      { label: "Network fee", value: `${fmt(feeInGasAsset)} ${gasAssetSymbol}` },
    ],
  });

  revalidatePath("/dashboard");
  return { error: null, success: true };
}
