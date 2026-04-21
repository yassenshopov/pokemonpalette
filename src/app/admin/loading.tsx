export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="container mx-auto px-6 py-12 space-y-6"
    >
      <span className="sr-only">Loading admin…</span>
      <div className="h-8 w-64 rounded bg-muted animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-28 rounded border bg-muted/40 animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 rounded border bg-muted/40 animate-pulse" />
    </div>
  );
}
