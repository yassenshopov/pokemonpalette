import { Loader2 } from "lucide-react";

interface LoaderOverlayProps {
  loading: boolean;
  text?: string;
}

export function LoaderOverlay({ loading, text }: LoaderOverlayProps) {
  if (!loading) return null;

  return (
    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
  );
}
