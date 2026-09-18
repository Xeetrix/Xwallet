export default function AdminAssetsLoading() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8 space-y-2">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-7 w-64" />
      </div>

      <div className="luxury-card p-6 mb-8 space-y-4">
        <div className="skeleton h-5 w-36" />
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>

      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="luxury-card p-6 mb-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-14" />
            </div>
          </div>
          <div className="skeleton h-12 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
