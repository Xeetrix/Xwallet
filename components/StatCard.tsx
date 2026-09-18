import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "gold" | "emerald" | "zinc";

const TONE_CLASSES: Record<Tone, string> = {
  gold: "bg-gold/10 border-gold/20 text-gold",
  emerald: "bg-emerald/10 border-emerald/20 text-emerald",
  zinc: "bg-zinc-800/60 border-zinc-700/60 text-zinc-300",
};

const TEXT_TONE_CLASSES: Record<Tone, string> = {
  gold: "text-gold",
  emerald: "text-emerald",
  zinc: "text-zinc-50",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "zinc",
  valueTone,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  valueTone?: Tone;
}) {
  return (
    <div className="luxury-card p-5 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gold/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 truncate">{label}</p>
          <p className={cn("font-serif text-2xl truncate", TEXT_TONE_CLASSES[valueTone ?? "zinc"])}>
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
