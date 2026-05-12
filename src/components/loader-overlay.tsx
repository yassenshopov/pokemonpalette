import { Loader2 } from "lucide-react";

interface LoaderOverlayProps {
  loading: boolean;
  text?: string;
}

export function LoaderOverlay({ loading, text }: LoaderOverlayProps) {
  if (!loading) return null;

  // Announce loading state to screen readers. `role="status"` +
  // aria-live="polite" pairs make AT users aware the page is busy without
  // interrupting whatever they're already reading. The decorative spinner
  // icon stays aria-hidden; the visible-or-fallback text is what gets
  // announced.
  return (
    <div
      className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2
          className="h-8 w-8 animate-spin text-foreground"
          aria-hidden="true"
        />
        {text ? (
          <p className="text-sm text-muted-foreground">{text}</p>
        ) : (
          <span className="sr-only">Loading</span>
        )}
      </div>
    </div>
  );
}
