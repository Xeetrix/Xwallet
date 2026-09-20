"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, type UserStatus } from "@/lib/auth";
import { sendAccountActivatedEmail, sendTransactionEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 8 });

export interface ActionResult {
  error: string | null;
  success: boolean;
}

class AlreadyReviewedError extends Error {}
class InsufficientBalanceError extends Error {}

export async function toggleUserStatus(userId: string, status: UserStatus): Promise<ActionResult> {
  const admin = await requireAdminSession();

  if (!userId) return { error: "Missing user.", success: false };

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      // Clear any outstanding self-verification token once an admin has
      // manually decided this account's status, so a stale emailed link
      // can't do anything unexpected later.
      ...(status !== "PENDING_APPROVAL" ? { emailVerificationToken: null, emailVerificationExpires: null } : {}),
    },
  });

  await writeAuditLog({
    actorId: admin.sub,
    action: "USER_STATUS_CHANGED",
    targetType: "User",
    targetId: userId,
    metadata: { newStatus: status, targetEmail: user.email },
  });

  if (status === "ACTIVE") {
    await sendAccountActivatedEmail({ to: user.email, fullName: user.fullName });
  }

  revalidatePath("/admin");
  return { error: null, success: true };
}

export async function createAsset(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireAdminSession();

  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!symbol || !name) {
    return { error: "Symbol and name are required.", success: false };
  }

  try {
    // Asset badges are resolved automatically from the ticker symbol at
    // render time (see components/CryptoIcon.tsx) — no logo URL to store.
    await prisma.asset.create({
      data: { symbol, name },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An asset with this symbol already exists.", success: false };
    }
    throw error;
  }

  revalidatePath("/admin/assets");
  return { error: null, success: true };
}

export async function toggleAssetActive(assetId: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();

  await prisma.asset.update({ where: { id: assetId }, data: { isActive } });
  revalidatePath("/admin/assets");
  return { error: null, success: true };
}

export async function configureAssetAddress(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const assetId = String(formData.get("assetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim().toUpperCase();
  const walletAddress = String(formData.get("walletAddress") ?? "").trim();

  if (!assetId || !networkName || !walletAddress) {
    return { error: "All fields are required.", success: false };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return { error: "Asset not found.", success: false };
  }

  try {
    await prisma.networkAddress.upsert({
      where: { assetId_networkName: { assetId, networkName } },
      create: { assetId, networkName, walletAddress, isActive: true },
      update: { walletAddress, isActive: true },
    });
  } catch {
    return { error: "Could not save the receiving address. Please try again.", success: false };
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: "NETWORK_ADDRESS_CONFIGURED",
    targetType: "Asset",
    targetId: assetId,
    metadata: { networkName, walletAddress },
  });

  revalidatePath("/admin/assets");
  return { error: null, success: true };
}

export async function toggleNetworkAddressActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();

  await prisma.networkAddress.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/assets");
  return { error: null, success: true };
}

export async function reviewDeposit(
  transactionId: string,
  action: "APPROVE" | "REJECT"
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: true, asset: true },
  });
  if (!transaction || transaction.type !== "DEPOSIT") {
    return { error: "Deposit not found.", success: false };
  }

  const nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional update guards against two concurrent reviews of the same
      // deposit (double-click, two admin tabs) racing past a separate
      // read-then-write check and double-crediting the balance.
      const updated = await tx.transaction.updateMany({
        where: { id: transactionId, status: "PENDING" },
        data: { status: nextStatus },
      });

      if (updated.count === 0) {
        throw new AlreadyReviewedError();
      }

      if (action === "APPROVE") {
        await tx.userBalance.upsert({
          where: {
            userId_assetId: { userId: transaction.userId, assetId: transaction.assetId },
          },
          create: {
            userId: transaction.userId,
            assetId: transaction.assetId,
            balance: transaction.amount,
          },
          update: {
            balance: { increment: transaction.amount },
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof AlreadyReviewedError) {
      return { error: "This deposit has already been reviewed.", success: false };
    }
    throw error;
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: action === "APPROVE" ? "DEPOSIT_APPROVED" : "DEPOSIT_REJECTED",
    targetType: "Transaction",
    targetId: transactionId,
    metadata: {
      amount: transaction.amount.toString(),
      assetSymbol: transaction.asset.symbol,
      txHash: transaction.txHash,
      clientEmail: transaction.user.email,
    },
  });

  await sendTransactionEmail({
    to: transaction.user.email,
    fullName: transaction.user.fullName,
    subject: action === "APPROVE" ? "Deposit approved" : "Deposit rejected",
    headline: action === "APPROVE" ? "Deposit approved" : "Deposit rejected",
    intro:
      action === "APPROVE"
        ? "Your deposit has been verified and credited to your account."
        : "Your deposit could not be verified and was not credited.",
    accent: action === "APPROVE" ? "emerald" : "red",
    rows: [
      { label: "Asset", value: transaction.asset.symbol },
      { label: "Amount", value: `${fmt(Number(transaction.amount))} ${transaction.asset.symbol}` },
      { label: "Status", value: nextStatus },
    ],
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function reviewWithdrawal(
  transactionId: string,
  action: "APPROVE" | "REJECT",
  txHash?: string
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: true, asset: true, feeAsset: true },
  });
  if (!transaction || transaction.type !== "WITHDRAWAL") {
    return { error: "Withdrawal not found.", success: false };
  }

  const nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  const trimmedTxHash = txHash?.trim();

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional update guards against two concurrent reviews of the same
      // withdrawal (double-click, two admin tabs) racing past a separate
      // read-then-write check and double-refunding the balance on reject.
      const updated = await tx.transaction.updateMany({
        where: { id: transactionId, status: "PENDING" },
        data: {
          status: nextStatus,
          ...(action === "APPROVE" && trimmedTxHash ? { txHash: trimmedTxHash } : {}),
        },
      });

      if (updated.count === 0) {
        throw new AlreadyReviewedError();
      }

      if (action === "REJECT") {
        // The withdrawal amount was already debited when the client
        // submitted the request — refund it now that the request won't be
        // fulfilled. The network fee was reserved separately, from the
        // network's gas asset, and needs refunding too — combined into
        // this same refund when the gas asset happens to be the asset
        // being withdrawn (e.g. withdrawing BTC over the BTC network).
        const sameAsset = transaction.feeAssetId === transaction.assetId;
        const mainRefund =
          sameAsset && transaction.feeAmount
            ? transaction.amount.plus(transaction.feeAmount)
            : transaction.amount;

        await tx.userBalance.upsert({
          where: {
            userId_assetId: { userId: transaction.userId, assetId: transaction.assetId },
          },
          create: {
            userId: transaction.userId,
            assetId: transaction.assetId,
            balance: mainRefund,
          },
          update: {
            balance: { increment: mainRefund },
          },
        });

        if (transaction.feeAssetId && transaction.feeAmount && !sameAsset) {
          await tx.userBalance.upsert({
            where: {
              userId_assetId: { userId: transaction.userId, assetId: transaction.feeAssetId },
            },
            create: {
              userId: transaction.userId,
              assetId: transaction.feeAssetId,
              balance: transaction.feeAmount,
            },
            update: {
              balance: { increment: transaction.feeAmount },
            },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof AlreadyReviewedError) {
      return { error: "This withdrawal has already been reviewed.", success: false };
    }
    // Transaction.txHash is unique across the whole table (see the deposit
    // dedup migration) — this also catches an admin accidentally pasting a
    // hash that's already recorded against a different transaction.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This transaction hash is already recorded against another transaction.", success: false };
    }
    throw error;
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: action === "APPROVE" ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
    targetType: "Transaction",
    targetId: transactionId,
    metadata: {
      amount: transaction.amount.toString(),
      assetSymbol: transaction.asset.symbol,
      destinationAddress: transaction.destinationAddress,
      txHash: trimmedTxHash ?? transaction.txHash,
      clientEmail: transaction.user.email,
    },
  });

  await sendTransactionEmail({
    to: transaction.user.email,
    fullName: transaction.user.fullName,
    subject: action === "APPROVE" ? "Withdrawal sent" : "Withdrawal rejected",
    headline: action === "APPROVE" ? "Withdrawal sent" : "Withdrawal rejected",
    intro:
      action === "APPROVE"
        ? "Your withdrawal has been sent to your destination address."
        : "Your withdrawal request could not be completed. The reserved amount and network fee have been refunded to your balance.",
    accent: action === "APPROVE" ? "emerald" : "red",
    rows: [
      { label: "Asset", value: transaction.asset.symbol },
      { label: "Amount", value: `${fmt(Number(transaction.amount))} ${transaction.asset.symbol}` },
      { label: "Destination", value: transaction.destinationAddress ?? "—" },
      ...(action === "APPROVE" && trimmedTxHash ? [{ label: "Transaction Hash", value: trimmedTxHash }] : []),
      { label: "Status", value: nextStatus },
    ],
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function manualBalanceAdjustment(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const userId = String(formData.get("userId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const type = String(formData.get("type") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const amount = Number(amountRaw);

  if (!userId || !assetId || (type !== "CREDIT" && type !== "DEBIT")) {
    return { error: "Missing required fields.", success: false };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount.", success: false };
  }
  if (!note) {
    return { error: "A reference note is mandatory for manual adjustments.", success: false };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (type === "CREDIT") {
        await tx.userBalance.upsert({
          where: { userId_assetId: { userId, assetId } },
          create: { userId, assetId, balance: amount },
          update: { balance: { increment: amount } },
        });
      } else {
        // Conditional update guards against two concurrent debits racing
        // past a separate read-then-write balance check and overdrawing
        // the account — only decrements if the balance still covers it.
        const updated = await tx.userBalance.updateMany({
          where: { userId, assetId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });

        if (updated.count === 0) {
          throw new InsufficientBalanceError();
        }
      }

      await tx.transaction.create({
        data: {
          userId,
          assetId,
          type: type === "CREDIT" ? "MANUAL_CREDIT" : "MANUAL_DEBIT",
          amount,
          status: "APPROVED",
          referenceNote: note,
        },
      });
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { error: "Insufficient balance for this debit.", success: false };
    }
    throw error;
  }

  const [user, asset] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.asset.findUnique({ where: { id: assetId } }),
  ]);

  await writeAuditLog({
    actorId: admin.sub,
    action: type === "CREDIT" ? "MANUAL_BALANCE_CREDITED" : "MANUAL_BALANCE_DEBITED",
    targetType: "User",
    targetId: userId,
    metadata: { assetSymbol: asset?.symbol, amount, note },
  });

  if (user && asset) {
    await sendTransactionEmail({
      to: user.email,
      fullName: user.fullName,
      subject: type === "CREDIT" ? "Balance credited" : "Balance debited",
      headline: type === "CREDIT" ? "Your balance was credited" : "Your balance was debited",
      intro: "A member of our custody desk made a manual adjustment to your account.",
      accent: type === "CREDIT" ? "emerald" : "red",
      rows: [
        { label: "Asset", value: asset.symbol },
        { label: "Amount", value: `${fmt(amount)} ${asset.symbol}` },
        { label: "Reference", value: note },
      ],
    });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
