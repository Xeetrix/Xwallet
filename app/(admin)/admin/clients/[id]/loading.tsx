export default function ClientDetailLoading() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="skeleton h-3 w-28 mb-6" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <div className="skeleton h-10 w-40 rounded-lg" />
          <div className="skeleton h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="luxury-card p-5 space-y-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="luxury-card p-6 mb-8 space-y-4">
        <div className="skeleton h-5 w-36" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton h-16 w-full rounded-xl" />
        ))}
      </div>

      <div className="luxury-card p-6 space-y-4">
        <div className="skeleton h-5 w-44" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
