"use client";

import { Heart, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContrastTextClass as getTextColor } from "@/lib/game/colors";
import type { Supporter } from "@/lib/buymeacoffee";

interface SupportersDisplayProps {
  primaryColor: string;
  secondaryColor: string;
  /**
   * Real BMC supporters, fetched server-side via `fetchSupporters()`.
   * Pass `[]` to render the CTA-only state (no avatar grid).
   */
  supporters: Supporter[];
  /**
   * Optional copy override for the heading. Defaults to "Supporters".
   * Useful on the /account page where "Project supporters" reads better
   * next to the user's own settings.
   */
  heading?: string;
}

/**
 * Wall of project supporters. Reads from the BMC Personal Access Token API
 * via `fetchSupporters()` — pass the result through `supporters`. Renders
 * gracefully with an empty list (CTA-only) so the section still looks
 * intentional before the token is configured or when BMC returns nothing.
 */
export function SupportersDisplay({
  primaryColor,
  secondaryColor,
  supporters,
  heading = "Supporters",
}: SupportersDisplayProps) {
  const hasSupporters = supporters.length > 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-6 sm:px-12 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Heart
          className="w-6 h-6"
          style={{ color: primaryColor }}
          fill={primaryColor}
        />
        <h2 className="text-2xl font-bold font-heading">{heading}</h2>
      </div>

      {hasSupporters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {supporters.map((supporter, index) => (
            <div
              key={`${supporter.name}-${index}`}
              className="group relative overflow-hidden rounded-lg p-4 transition-transform duration-300 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}15 100%)`,
                border: `1px solid ${primaryColor}30`,
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className={getTextColor(primaryColor)}>
                    {supporter.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground break-words">
                    {supporter.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {supporter.kind === "monthly"
                      ? `$${supporter.amount}/mo`
                      : `$${supporter.amount}`}
                  </p>
                </div>
              </div>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at center, ${primaryColor}20 0%, transparent 70%)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground text-center">
          {hasSupporters
            ? "Thank you to everyone keeping PokémonPalette ad-free-ish and alive."
            : "PokémonPalette is built by one developer on nights and weekends — your support keeps it shipping."}
        </p>
        <a
          href="https://buymeacoffee.com/yassenshopov?utm_source=pokemonpalette&utm_medium=supporters_wall&utm_campaign=join"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            className="shadow-none cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
            style={{
              backgroundColor: primaryColor,
              color:
                getTextColor(primaryColor) === "text-white"
                  ? "#ffffff"
                  : "#000000",
            }}
          >
            <Coffee className="w-4 h-4 mr-2 transition-transform duration-300 hover:rotate-12" />
            {hasSupporters ? "Join them" : "Support the project"}
          </Button>
        </a>
      </div>
    </div>
  );
}
