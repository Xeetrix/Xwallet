"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, type UserStatus } from "@/lib/auth";

export interface ActionResult {
  error: string | null;
  success: boolean;
}

class AlreadyReviewedError extends Error {}
class InsufficientBalanceError extends Error {}

export async function toggleUserStatus(userId: string, status: UserStatus): Promise<ActionResult> {
  await requireAdminSession();

  if (!userId) return { error: "Missing user.", success: false };

  await prisma.user.update({ where: { id: userId }, data: { status } });
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
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();

  if (!symbol || !name) {
    return { error: "Symbol and name are required.", success: false };
  }

  try {
    await prisma.asset.create({
      data: { symbol, name, logoUrl: logoUrl || null },
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
  await requireAdminSession();

  const assetId = String(formData.get("assetId") ?? "");
  const networkName = String(formData.get("networkName") ?? "").trim().toUpperCase();
  const walletAddress = String(formData.get("walletAddress") ?? "").trim();

  if (!assetId || !networkName || !walletAddress) {
    return { error: "All fields are required.", success: false };
  }

  await prisma.networkAddress.upsert({
    where: { assetId_networkName: { assetId, networkName } },
    create: { assetId, networkName, walletAddress, isActive: true },
    update: { walletAddress, isActive: true },
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
  await requireAdminSession();

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
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

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function manualBalanceAdjustment(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireAdminSession();

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

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
