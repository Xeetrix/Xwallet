"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type KycTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, type UserStatus } from "@/lib/auth";
import { sendAccountActivatedEmail, sendTransactionEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { writeLedgerEntries, SYSTEM_RESERVE_ACCOUNT, GAS_FEE_COLLECTOR_ACCOUNT } from "@/lib/ledger";

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

export async function createCustodyVault(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const chainId = Number(formData.get("chainId"));
  const vaultAddress = String(formData.get("vaultAddress") ?? "").trim();
  const threshold = Number(formData.get("threshold"));
  const signers = String(formData.get("signers") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name || !provider || !vaultAddress) {
    return { error: "Name, provider, and vault address are required.", success: false };
  }
  if (!Number.isFinite(chainId) || chainId <= 0) {
    return { error: "Enter a valid chain ID.", success: false };
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > signers.length) {
    return { error: "Threshold must be a whole number between 1 and the number of signers.", success: false };
  }
  if (signers.length === 0) {
    return { error: "At least one signer address is required.", success: false };
  }

  const vault = await prisma.custodyVault.create({
    data: { name, provider, chainId, vaultAddress, threshold, signers },
  });

  await writeAuditLog({
    actorId: admin.sub,
    action: "CUSTODY_VAULT_CREATED",
    targetType: "CustodyVault",
    targetId: vault.id,
    metadata: { name, provider, chainId, vaultAddress, threshold, signerCount: signers.length },
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/reserves");
  return { error: null, success: true };
}

export async function toggleCustodyVaultActive(vaultId: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdminSession();

  await prisma.custodyVault.update({ where: { id: vaultId }, data: { isActive } });

  await writeAuditLog({
    actorId: admin.sub,
    action: isActive ? "CUSTODY_VAULT_ACTIVATED" : "CUSTODY_VAULT_DEACTIVATED",
    targetType: "CustodyVault",
    targetId: vaultId,
    metadata: {},
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/reserves");
  return { error: null, success: true };
}

/**
 * Admin-recorded snapshot of what the vault actually holds on-chain — this
 * is manual input, not a live chain read (no RPC/indexer wiring exists
 * yet), so the Proof-of-Reserve dashboard is only as fresh as the last time
 * an admin updated this. Upserted per vault+asset.
 */
export async function updateVaultReserve(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const vaultId = String(formData.get("vaultId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const balanceRaw = String(formData.get("balance") ?? "");
  const balance = Number(balanceRaw);

  if (!vaultId || !assetId) {
    return { error: "Vault and asset are required.", success: false };
  }
  if (!Number.isFinite(balance) || balance < 0) {
    return { error: "Enter a valid non-negative balance.", success: false };
  }

  await prisma.vaultReserve.upsert({
    where: { vaultId_assetId: { vaultId, assetId } },
    create: { vaultId, assetId, balance },
    update: { balance },
  });

  await writeAuditLog({
    actorId: admin.sub,
    action: "VAULT_RESERVE_UPDATED",
    targetType: "CustodyVault",
    targetId: vaultId,
    metadata: { assetId, balance },
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/reserves");
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

        // Double-entry: the client's claim increases, offset by the
        // platform's reserve account (the real crypto arrived in custody,
        // which is what the deposit review is verifying).
        await writeLedgerEntries(tx, transactionId, [
          { accountId: transaction.userId, assetId: transaction.assetId, direction: "CREDIT", amount: transaction.amount },
          { accountId: SYSTEM_RESERVE_ACCOUNT, assetId: transaction.assetId, direction: "DEBIT", amount: transaction.amount },
        ]);
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

/**
 * Step 1 of the institutional withdrawal workflow: PENDING -> QUEUED
 * (multi-sig proposal) or PENDING -> REJECTED (refund). APPROVE no longer
 * moves real funds or takes a txHash — it only queues the parameters an
 * off-chain Safe/MPC signing process needs. The actual on-chain send is
 * confirmed separately via executeQueuedWithdrawal() once it has really
 * happened, closing the gap where "approved in this UI" and "money
 * actually left custody" could otherwise be two different moments with no
 * record of the difference.
 */
export async function reviewWithdrawal(
  transactionId: string,
  action: "APPROVE" | "REJECT"
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: true, asset: true, feeAsset: true },
  });
  if (!transaction || transaction.type !== "WITHDRAWAL") {
    return { error: "Withdrawal not found.", success: false };
  }

  let vault: { id: string; vaultAddress: string; chainId: number; threshold: number; signers: string[] } | null =
    null;
  if (action === "APPROVE") {
    vault = await prisma.custodyVault.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (!vault) {
      return {
        error: "No active custody vault is configured. Add one on the Assets page before approving withdrawals.",
        success: false,
      };
    }
  }

  const nextStatus = action === "APPROVE" ? "QUEUED" : "REJECTED";

  const multisigProposal =
    action === "APPROVE" && vault
      ? {
          to: transaction.destinationAddress,
          assetSymbol: transaction.asset.symbol,
          networkName: transaction.networkName,
          valueAmount: transaction.amount.toString(),
          chainId: vault.chainId,
          vaultId: vault.id,
          vaultAddress: vault.vaultAddress,
          threshold: vault.threshold,
          signers: vault.signers,
          proposedAt: new Date().toISOString(),
          proposedBy: admin.sub,
        }
      : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional update guards against two concurrent reviews of the same
      // withdrawal (double-click, two admin tabs) racing past a separate
      // read-then-write check and double-refunding the balance on reject.
      const updated = await tx.transaction.updateMany({
        where: { id: transactionId, status: "PENDING" },
        data: {
          status: nextStatus,
          ...(multisigProposal ? { multisigProposal } : {}),
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

        // Double-entry: exact reversal of the entries requestWithdrawal
        // wrote at request time — the client's claim is restored, offset
        // by reversing the reserve/fee-collector side. Written as
        // independent rows regardless of whether assetId === feeAssetId;
        // LedgerEntry has no per-account+asset uniqueness constraint, so
        // multiple rows summing correctly is the expected shape.
        const reversalEntries = [
          { accountId: transaction.userId, assetId: transaction.assetId, direction: "CREDIT" as const, amount: transaction.amount },
          { accountId: SYSTEM_RESERVE_ACCOUNT, assetId: transaction.assetId, direction: "DEBIT" as const, amount: transaction.amount },
        ];
        if (transaction.feeAssetId && transaction.feeAmount) {
          reversalEntries.push(
            { accountId: transaction.userId, assetId: transaction.feeAssetId, direction: "CREDIT" as const, amount: transaction.feeAmount },
            { accountId: GAS_FEE_COLLECTOR_ACCOUNT, assetId: transaction.feeAssetId, direction: "DEBIT" as const, amount: transaction.feeAmount }
          );
        }
        await writeLedgerEntries(tx, transactionId, reversalEntries);
      }
    });
  } catch (error) {
    if (error instanceof AlreadyReviewedError) {
      return { error: "This withdrawal has already been reviewed.", success: false };
    }
    throw error;
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: action === "APPROVE" ? "WITHDRAWAL_QUEUED" : "WITHDRAWAL_REJECTED",
    targetType: "Transaction",
    targetId: transactionId,
    metadata: {
      amount: transaction.amount.toString(),
      assetSymbol: transaction.asset.symbol,
      destinationAddress: transaction.destinationAddress,
      clientEmail: transaction.user.email,
      ...(multisigProposal ? { vaultId: multisigProposal.vaultId } : {}),
    },
  });

  await sendTransactionEmail({
    to: transaction.user.email,
    fullName: transaction.user.fullName,
    subject: action === "APPROVE" ? "Withdrawal queued for processing" : "Withdrawal rejected",
    headline: action === "APPROVE" ? "Withdrawal queued for processing" : "Withdrawal rejected",
    intro:
      action === "APPROVE"
        ? "Your withdrawal has been approved and queued with our custody desk for final execution. You'll receive another email once it's sent."
        : "Your withdrawal request could not be completed. The reserved amount and network fee have been refunded to your balance.",
    accent: action === "APPROVE" ? "gold" : "red",
    rows: [
      { label: "Asset", value: transaction.asset.symbol },
      { label: "Amount", value: `${fmt(Number(transaction.amount))} ${transaction.asset.symbol}` },
      { label: "Destination", value: transaction.destinationAddress ?? "—" },
      { label: "Status", value: nextStatus },
    ],
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

/**
 * Step 2: once the queued multi-sig transaction has actually executed
 * on-chain, an admin confirms it here with the real txHash — QUEUED ->
 * APPROVED. No balance or ledger change: the client's balance was already
 * debited and the ledger entries already written at request time.
 */
export async function executeQueuedWithdrawal(transactionId: string, txHash: string): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const trimmedTxHash = txHash.trim();
  if (!trimmedTxHash) {
    return { error: "A transaction hash is required to mark this as executed.", success: false };
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: true, asset: true },
  });
  if (!transaction || transaction.type !== "WITHDRAWAL") {
    return { error: "Withdrawal not found.", success: false };
  }

  try {
    const updated = await prisma.transaction.updateMany({
      where: { id: transactionId, status: "QUEUED" },
      data: { status: "APPROVED", txHash: trimmedTxHash },
    });
    if (updated.count === 0) {
      return { error: "This withdrawal is not currently queued for execution.", success: false };
    }
  } catch (error) {
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
    action: "WITHDRAWAL_EXECUTED",
    targetType: "Transaction",
    targetId: transactionId,
    metadata: { txHash: trimmedTxHash, amount: transaction.amount.toString(), assetSymbol: transaction.asset.symbol },
  });

  await sendTransactionEmail({
    to: transaction.user.email,
    fullName: transaction.user.fullName,
    subject: "Withdrawal sent",
    headline: "Withdrawal sent",
    intro: "Your withdrawal has been sent to your destination address.",
    accent: "emerald",
    rows: [
      { label: "Asset", value: transaction.asset.symbol },
      { label: "Amount", value: `${fmt(Number(transaction.amount))} ${transaction.asset.symbol}` },
      { label: "Destination", value: transaction.destinationAddress ?? "—" },
      { label: "Transaction Hash", value: trimmedTxHash },
      { label: "Status", value: "APPROVED" },
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

      const adjustmentTx = await tx.transaction.create({
        data: {
          userId,
          assetId,
          type: type === "CREDIT" ? "MANUAL_CREDIT" : "MANUAL_DEBIT",
          amount,
          status: "APPROVED",
          referenceNote: note,
        },
      });

      // A manual credit originates from the custody desk's reserve (e.g.
      // correcting an operator error); a manual debit returns funds to it.
      // Either way the reserve absorbs the non-client side, same as every
      // other ledger-backed path.
      await writeLedgerEntries(tx, adjustmentTx.id, [
        {
          accountId: userId,
          assetId,
          direction: type === "CREDIT" ? "CREDIT" : "DEBIT",
          amount,
        },
        {
          accountId: SYSTEM_RESERVE_ACCOUNT,
          assetId,
          direction: type === "CREDIT" ? "DEBIT" : "CREDIT",
          amount,
        },
      ]);
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

export async function revokeSession(sessionId: string, userId: string): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    return { error: "Session not found.", success: false };
  }
  if (session.revokedAt) {
    return { error: "This session has already been revoked.", success: false };
  }

  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });

  await writeAuditLog({
    actorId: admin.sub,
    action: "SESSION_REVOKED",
    targetType: "User",
    targetId: userId,
    metadata: { sessionId, ipAddress: session.ipAddress, userAgent: session.userAgent },
  });

  revalidatePath(`/admin/clients/${userId}`);
  return { error: null, success: true };
}

export async function assignUnattributedDeposit(
  unattributedDepositId: string,
  userId: string
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  const deposit = await prisma.unattributedDeposit.findUnique({
    where: { id: unattributedDepositId },
    include: { asset: true },
  });
  if (!deposit) {
    return { error: "Unattributed deposit not found.", success: false };
  }
  if (deposit.status !== "PENDING") {
    return { error: "This deposit has already been assigned.", success: false };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "CLIENT") {
    return { error: "Selected client not found.", success: false };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.unattributedDeposit.updateMany({
        where: { id: unattributedDepositId, status: "PENDING" },
        data: { status: "ASSIGNED", assignedUserId: userId },
      });
      if (updated.count === 0) {
        throw new AlreadyReviewedError();
      }

      // Reuses the same txHash unique constraint as every other deposit
      // path — a create here can never double-credit the same on-chain
      // event, since UnattributedDeposit.txHash and Transaction.txHash
      // draw from the same value and Transaction.txHash is globally unique.
      const depositTx = await tx.transaction.create({
        data: {
          userId,
          assetId: deposit.assetId,
          networkName: deposit.networkName,
          type: "DEPOSIT",
          amount: deposit.amount,
          txHash: deposit.txHash,
          status: "APPROVED",
          referenceNote: "Matched from unattributed on-chain deposit queue.",
        },
      });

      await tx.userBalance.upsert({
        where: { userId_assetId: { userId, assetId: deposit.assetId } },
        create: { userId, assetId: deposit.assetId, balance: deposit.amount },
        update: { balance: { increment: deposit.amount } },
      });

      await writeLedgerEntries(tx, depositTx.id, [
        { accountId: userId, assetId: deposit.assetId, direction: "CREDIT", amount: deposit.amount },
        { accountId: SYSTEM_RESERVE_ACCOUNT, assetId: deposit.assetId, direction: "DEBIT", amount: deposit.amount },
      ]);
    });
  } catch (error) {
    if (error instanceof AlreadyReviewedError) {
      return { error: "This deposit has already been assigned.", success: false };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This transaction hash is already recorded against another transaction.", success: false };
    }
    throw error;
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: "UNATTRIBUTED_DEPOSIT_ASSIGNED",
    targetType: "UnattributedDeposit",
    targetId: unattributedDepositId,
    metadata: { assignedUserId: userId, txHash: deposit.txHash, amount: deposit.amount.toString() },
  });

  await sendTransactionEmail({
    to: user.email,
    fullName: user.fullName,
    subject: "Deposit approved",
    headline: "Deposit approved",
    intro: "Your deposit has been verified on-chain and credited to your account.",
    accent: "emerald",
    rows: [
      { label: "Asset", value: deposit.asset.symbol },
      { label: "Amount", value: `${fmt(Number(deposit.amount))} ${deposit.asset.symbol}` },
      { label: "Status", value: "APPROVED" },
    ],
  });

  revalidatePath("/admin/deposits");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function updateClientKyc(
  userId: string,
  kycTier: KycTier,
  dailyLimitUsd: number | null,
  monthlyLimitUsd: number | null
): Promise<ActionResult> {
  const admin = await requireAdminSession();

  if (dailyLimitUsd !== null && (!Number.isFinite(dailyLimitUsd) || dailyLimitUsd < 0)) {
    return { error: "Daily limit must be a non-negative number.", success: false };
  }
  if (monthlyLimitUsd !== null && (!Number.isFinite(monthlyLimitUsd) || monthlyLimitUsd < 0)) {
    return { error: "Monthly limit must be a non-negative number.", success: false };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { kycTier, dailyLimitUsd, monthlyLimitUsd },
  });

  await writeAuditLog({
    actorId: admin.sub,
    action: "KYC_SETTINGS_UPDATED",
    targetType: "User",
    targetId: userId,
    metadata: { kycTier, dailyLimitUsd, monthlyLimitUsd },
  });

  revalidatePath(`/admin/clients/${userId}`);
  return { error: null, success: true };
}
