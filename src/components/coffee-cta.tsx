"use client";

import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): "text-white" | "text-black" => {
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "text-black" : "text-white";
};

interface CoffeeCTAProps {
  primaryColor?: string;
}

export function CoffeeCTA({ primaryColor = "#f59e0b" }: CoffeeCTAProps) {
  const textColor = getTextColor(primaryColor);
  
  return (
    <div className="fixed top-4 left-4 md:top-6 md:left-auto md:right-12 z-50">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes auto-shine {
              0%, 85% {
                transform: translateX(-100%);
              }
              95% {
                transform: translateX(100%);
              }
              100% {
                transform: translateX(100%);
              }
            }
            
            .coffee-cta-auto-shine {
              animation: auto-shine 6s ease-in-out infinite;
              animation-delay: 3s;
            }
          `,
        }}
      />
      <a
        href="https://buymeacoffee.com/yassenshopov"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Button
          size="default"
          className="border-2 cursor-pointer font-medium transition-all duration-300 hover:scale-105 active:scale-95 relative overflow-hidden group px-3 py-2 md:px-4"
          style={{
            backgroundColor: primaryColor,
            borderColor: primaryColor,
            color: textColor === "text-white" ? "#ffffff" : "#000000",
          }}
        >
          {/* Hover shine animation overlay */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          {/* Automatic shine animation overlay */}
          <div className="coffee-cta-auto-shine absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          
          <Coffee className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2 transition-transform duration-300 hover:rotate-12 relative z-10" />
          <span className="relative z-10 text-sm md:text-base">Buy Me a Coffee</span>
        </Button>
      </a>
    </div>
  );
}
