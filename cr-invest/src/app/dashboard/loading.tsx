export default function DashboardLoading() {
  return (
    <div className="flex-1 p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-gray-200" />
          <div className="h-9 w-32 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Cards row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-gray-100 p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="h-7 w-28 rounded bg-gray-200" />
            <div className="h-2 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-gray-100 p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="h-7 w-32 rounded bg-gray-200" />
            <div className="h-2 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-2xl bg-gray-100 p-5">
        <div className="h-4 w-40 rounded bg-gray-200 mb-6" />
        <div className="h-48 w-full rounded-xl bg-gray-200" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl bg-gray-100 p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-gray-200 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 flex-1 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
