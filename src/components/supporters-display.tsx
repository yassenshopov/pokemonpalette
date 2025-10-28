"use client";

import { Heart, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Supporter {
  name: string;
  amount: number;
}

interface SupportersDisplayProps {
  primaryColor: string;
  secondaryColor: string;
}

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

// Mock data - replace with real API call later
const mockSupporters: Supporter[] = [
  { name: "Alex Johnson", amount: 5 },
  { name: "Sarah Chen", amount: 10 },
  { name: "Marcus Rivera", amount: 5 },
  { name: "Emma Watson", amount: 20 },
  { name: "Daniel Kim", amount: 3 },
  { name: "Sophie Brown", amount: 5 },
  { name: "James Wilson", amount: 10 },
  { name: "Olivia Martinez", amount: 5 },
];

export function SupportersDisplay({
  primaryColor,
  secondaryColor,
}: SupportersDisplayProps) {
  return (
    <div className="w-full max-w-6xl mx-auto px-12 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Heart
          className="w-6 h-6"
          style={{ color: primaryColor }}
          fill={primaryColor}
        />
        <h2 className="text-2xl font-bold font-heading">Supporters</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mockSupporters.map((supporter, index) => (
          <div
            key={index}
            className="group relative overflow-hidden rounded-lg p-4 transition-all duration-300 hover:scale-105"
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
                <p className="text-sm font-semibold text-foreground">
                  {supporter.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ${supporter.amount}/month
                </p>
              </div>
            </div>

            {/* Hover effect */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at center, ${primaryColor}20 0%, transparent 70%)`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Thank you to all our amazing supporters!
        </p>
        <a
          href="https://buymeacoffee.com/yassenshopov"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            className="shadow-none cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              backgroundColor: primaryColor,
              color:
                getTextColor(primaryColor) === "text-white"
                  ? "#ffffff"
                  : "#000000",
            }}
          >
            <Coffee className="w-4 h-4 mr-2 transition-transform duration-300 hover:rotate-12" />
            Buy Me a Coffee
          </Button>
        </a>
      </div>
    </div>
  );
}
