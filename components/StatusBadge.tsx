import { cn } from "@/lib/utils";

type Tone = "gold" | "emerald" | "red" | "zinc";

const TONE_CLASSES: Record<Tone, string> = {
  gold: "text-gold border-gold/30 bg-gold/10",
  emerald: "text-emerald border-emerald/30 bg-emerald/10",
  red: "text-red-400 border-red-500/30 bg-red-500/10",
  zinc: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
};

const STATUS_CONFIG: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "emerald" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "gold" },
  SUSPENDED: { label: "Suspended", tone: "red" },
  PENDING: { label: "Pending", tone: "gold" },
  QUEUED: { label: "Queued", tone: "gold" },
  APPROVED: { label: "Approved", tone: "emerald" },
  REJECTED: { label: "Rejected", tone: "red" },
};

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, tone: "zinc" as Tone };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        TONE_CLASSES[config.tone],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
