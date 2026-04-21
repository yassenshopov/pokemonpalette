export default function GameLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] flex items-center justify-center"
    >
      <span className="sr-only">Loading daily puzzle…</span>
      <div
        aria-hidden="true"
        className="h-10 w-10 rounded-full border-2 border-muted-foreground/20 border-t-foreground animate-spin"
      />
    </div>
  );
}
