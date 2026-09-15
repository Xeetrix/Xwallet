"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export interface DepositActionState {
  error: string | null;
  success: boolean;
}

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
