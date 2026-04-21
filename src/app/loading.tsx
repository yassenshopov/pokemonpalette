/**
 * Root loading UI. Shown automatically by Next while a server-rendered
 * route segment is pending. We keep it intentionally minimal so it doesn't
 * flash for fast transitions but still tells the user something is
 * happening on slow navigations.
 */
export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex items-center justify-center"
    >
      <span className="sr-only">Loading…</span>
      <div
        aria-hidden="true"
        className="h-10 w-10 rounded-full border-2 border-muted-foreground/20 border-t-foreground animate-spin"
      />
    </div>
  );
}
