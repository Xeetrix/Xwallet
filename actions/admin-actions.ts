"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, type UserStatus } from "@/lib/auth";

export interface ActionResult {
  error: string | null;
  success: boolean;
}

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

  const existing = await prisma.asset.findUnique({ where: { symbol } });
  if (existing) {
    return { error: "An asset with this symbol already exists.", success: false };
  }

  await prisma.asset.create({
    data: { symbol, name, logoUrl: logoUrl || null },
  });

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
  if (transaction.status !== "PENDING") {
    return { error: "This deposit has already been reviewed.", success: false };
  }

  if (action === "REJECT") {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "REJECTED" },
    });
    revalidatePath("/admin");
    return { error: null, success: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "APPROVED" },
    });

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
  });

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

  if (type === "DEBIT") {
    const currentBalance = await prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });
    const current = currentBalance ? Number(currentBalance.balance) : 0;
    if (current < amount) {
      return { error: "Insufficient balance for this debit.", success: false };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userBalance.upsert({
      where: { userId_assetId: { userId, assetId } },
      create: {
        userId,
        assetId,
        balance: type === "CREDIT" ? amount : -amount,
      },
      update: {
        balance: type === "CREDIT" ? { increment: amount } : { decrement: amount },
      },
    });

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

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
