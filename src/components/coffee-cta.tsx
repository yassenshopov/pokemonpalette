"use client";

import { Coffee } from "lucide-react";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { getContrastHex } from "@/lib/game/colors";

interface CoffeeCTAProps {
  primaryColor?: string;
  /**
   * Where on the page this instance is rendered. Used purely for analytics so
   * we can compare conversion across placements (persistent floater vs.
   * in-dialog ask, etc.) without guessing.
   */
  placement?: string;
}

const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/yassenshopov";

export function CoffeeCTA({
  primaryColor = "#f59e0b",
  placement = "persistent",
}: CoffeeCTAProps) {
  const textColor = getContrastHex(primaryColor);

  const handleClick = () => {
    track("coffee_clicked", { placement });
  };

  return (
    <>
      {/* Desktop: pill in the top-right corner. Mobile: compact pill in the
          bottom-right so it doesn't fight the palette/header for attention.
          The auto-shimmer has been removed — it read as an ad and we want
          this to feel like a genuine ask, not a promo. */}
      <div className="hidden md:block fixed top-6 right-12 z-50">
        <a
          href={`${BUY_ME_A_COFFEE_URL}?utm_source=pokemonpalette&utm_medium=cta&utm_campaign=persistent_desktop`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          aria-label="Support the developer with a coffee"
        >
          <Button
            size="default"
            className="border-2 cursor-pointer font-medium font-heading transition-all duration-300 hover:scale-105 active:scale-95 relative overflow-hidden group shadow-sm"
            style={{
              backgroundColor: primaryColor,
              borderColor: primaryColor,
              color: textColor,
            }}
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <Coffee className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-12 relative z-10" />
            <span className="relative z-10">Buy me a coffee</span>
          </Button>
        </a>
      </div>

      <div className="md:hidden fixed bottom-4 right-4 z-50">
        <a
          href={`${BUY_ME_A_COFFEE_URL}?utm_source=pokemonpalette&utm_medium=cta&utm_campaign=persistent_mobile`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          aria-label="Support the developer with a coffee"
        >
          <Button
            size="icon"
            className="h-12 w-12 rounded-full border-2 cursor-pointer shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: primaryColor,
              borderColor: primaryColor,
              color: textColor,
            }}
          >
            <Coffee className="w-5 h-5" />
          </Button>
        </a>
      </div>
    </>
  );
}
