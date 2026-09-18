"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginUser, type AuthActionState } from "@/actions/auth-actions";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginUser, initialState);

  return (
    <div>
      <h2 className="font-serif text-xl text-zinc-100 mb-1">Welcome back</h2>
      <p className="text-sm text-zinc-500 mb-6">Sign in to access your private ledger.</p>

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            required
            className="luxury-input"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Password</label>
          <input
            name="password"
            type="password"
            required
            className="luxury-input"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Not a member yet?{" "}
        <Link href="/register" className="text-gold hover:text-gold-light">
          Request access
        </Link>
      </p>
    </div>
  );
}
