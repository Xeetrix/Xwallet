"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerUser, type AuthActionState } from "@/actions/auth-actions";

const initialState: AuthActionState = { error: null };

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerUser, initialState);

  return (
    <div>
      <h2 className="font-serif text-xl text-zinc-100 mb-1">Request Access</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Membership is by invitation. Submit your details for review.
      </p>

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
            Full Name
          </label>
          <input
            name="fullName"
            type="text"
            required
            className="luxury-input"
            placeholder="Jonathan Lee"
          />
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="luxury-input"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Confirm
            </label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="luxury-input"
              placeholder="••••••••"
            />
          </div>
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
          {pending ? "Submitting..." : "Submit Application"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already a member?{" "}
        <Link href="/login" className="text-gold hover:text-gold-light">
          Sign in
        </Link>
      </p>
    </div>
  );
}
