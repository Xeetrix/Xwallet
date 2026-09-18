export default function TransactionsLedgerLoading() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8 space-y-2">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-7 w-56" />
      </div>

      <div className="luxury-card p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>

      <div className="luxury-card p-6 space-y-4">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
