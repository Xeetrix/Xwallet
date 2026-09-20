"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";

export default function StatementExportCard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <div className="luxury-card p-6 mb-8">
      <h2 className="font-serif text-lg text-zinc-100 mb-5 flex items-center gap-2">
        <FileText className="w-4 h-4 text-gold" />
        Export Statement
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="luxury-input"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="luxury-input" />
        </div>
      </div>
      <p className="text-xs text-zinc-600 mb-4">Leave blank to export the last 90 days.</p>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/statements/csv${query}`}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:border-gold/40 text-zinc-100 text-sm font-medium px-4 py-2.5 transition"
        >
          <Download className="w-4 h-4 text-gold" />
          Download CSV
        </a>
        <a
          href={`/api/statements/pdf${query}`}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:border-gold/40 text-zinc-100 text-sm font-medium px-4 py-2.5 transition"
        >
          <Download className="w-4 h-4 text-gold" />
          Download PDF
        </a>
      </div>
    </div>
  );
}
