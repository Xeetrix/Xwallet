import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutUser } from "@/actions/auth-actions";

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-5">
        <Clock className="w-6 h-6 text-gold" />
      </div>
      <h2 className="font-serif text-xl text-zinc-100 mb-2">Application Under Review</h2>
      <p className="text-sm text-zinc-500 leading-relaxed mb-6">
        Thank you, {session.fullName.split(" ")[0]}. Your membership request is being reviewed by our
        private wealth desk. You will be notified once your account is activated.
      </p>
      <form action={logoutUser}>
        <button
          type="submit"
          className="text-sm text-zinc-400 hover:text-gold transition border border-zinc-800/60 rounded-lg px-4 py-2"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
