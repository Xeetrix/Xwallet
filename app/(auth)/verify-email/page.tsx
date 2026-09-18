import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS_CONTENT: Record<
  string,
  { icon: typeof CheckCircle2; tone: "emerald" | "red" | "gold"; title: string; message: string }
> = {
  success: {
    icon: CheckCircle2,
    tone: "emerald",
    title: "Email Confirmed",
    message: "Your email address has been verified. You can now sign in to your account.",
  },
  "already-active": {
    icon: CheckCircle2,
    tone: "emerald",
    title: "Already Active",
    message: "This account has already been verified or approved. You can sign in now.",
  },
  expired: {
    icon: Clock,
    tone: "gold",
    title: "Link Expired",
    message:
      "This confirmation link has expired. Please contact our custody desk at support@xwallet.asia, or wait for manual approval.",
  },
  invalid: {
    icon: XCircle,
    tone: "red",
    title: "Invalid Link",
    message:
      "This confirmation link is invalid or has already been used. If you believe this is an error, contact support@xwallet.asia.",
  },
};

const TONE_CLASSES: Record<"emerald" | "red" | "gold", { bg: string; border: string; text: string }> = {
  emerald: { bg: "bg-emerald/10", border: "border-emerald/30", text: "text-emerald" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
  gold: { bg: "bg-gold/10", border: "border-gold/30", text: "text-gold" },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const content = STATUS_CONTENT[status ?? ""] ?? STATUS_CONTENT.invalid;
  const Icon = content.icon;
  const tone = TONE_CLASSES[content.tone];

  return (
    <div className="text-center">
      <div
        className={`mx-auto w-14 h-14 rounded-full ${tone.bg} border ${tone.border} flex items-center justify-center mb-5`}
      >
        <Icon className={`w-6 h-6 ${tone.text}`} />
      </div>
      <h2 className="font-serif text-xl text-zinc-100 mb-2">{content.title}</h2>
      <p className="text-sm text-zinc-500 leading-relaxed mb-6">{content.message}</p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm px-4 py-2.5 transition"
      >
        Go to Sign In
      </Link>
    </div>
  );
}
