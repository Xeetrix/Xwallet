import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Best-effort client IP extraction from standard proxy headers (Vercel sets
 * x-forwarded-for). Never throws — an audit log missing an IP is far better
 * than an admin action failing because of a logging helper.
 */
export async function getClientIp(): Promise<string | null> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return headerList.get("x-real-ip");
  } catch {
    return null;
  }
}

/**
 * Writes an immutable audit trail entry for an admin action that changes
 * account state or platform configuration but isn't itself a Transaction
 * row (Transaction already covers money movement). Never throws — a
 * logging failure must never block or roll back the admin action it
 * describes, so any error here is swallowed after being logged to the
 * server console.
 */
export async function writeAuditLog(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonObject;
}): Promise<void> {
  try {
    const ipAddress = await getClientIp();
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        ipAddress,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] Failed to record "${params.action}" on ${params.targetType}:`, error);
  }
}
