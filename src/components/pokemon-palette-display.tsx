"use client";

import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { gsap } from "gsap";

interface PokemonPaletteDisplayProps {
  colors: string[];
}

// Helper function to convert colors
const convertColor = (hex: string, format: "hex" | "hsl" | "rgb"): string => {
  if (format === "hex") return hex;

  // Remove # if present
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  if (format === "rgb") {
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Convert to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `hsl(${h}, ${s}%, ${l}%)`;
};

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): string => {
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "text-black" : "text-white";
};

export function PokemonPaletteDisplay({ colors }: PokemonPaletteDisplayProps) {
  const [colorFormat, setColorFormat] = useState<"hex" | "hsl" | "rgb">("hex");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Animate cards in with stagger
    gsap.fromTo(
      cardsRef.current.filter(Boolean),
      {
        opacity: 0,
        y: 20,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.05,
        ease: "back.out(1.7)",
      }
    );
  }, [colors]);

  const handleCopy = async (color: string, index: number) => {
    try {
      await navigator.clipboard.writeText(color);
      setCopiedIndex(index);

      // Animate the card when copied
      const card = cardsRef.current[index];
      if (card) {
        gsap.to(card, {
          scale: 0.95,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: "power2.inOut",
        });
      }

      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success("Color copied!");
    } catch (error) {
      toast.error("Failed to copy color");
    }
  };

  if (colors.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-12 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-heading">Color Palette</h2>
        <Select
          value={colorFormat}
          onValueChange={(value: "hex" | "hsl" | "rgb") =>
            setColorFormat(value)
          }
        >
          <SelectTrigger className="w-[180px] shadow-none cursor-pointer">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hex">HEX</SelectItem>
            <SelectItem value="rgb">RGB</SelectItem>
            <SelectItem value="hsl">HSL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {colors.map((color, index) => {
          const colorValue = convertColor(color, colorFormat);
          return (
            <div
              key={index}
              ref={(el) => {
                cardsRef.current[index] = el;
              }}
              className="w-full h-24 rounded-lg p-4 flex items-center justify-between cursor-pointer group"
              style={{ backgroundColor: color }}
              onClick={() => handleCopy(colorValue, index)}
            >
              <span
                className={`text-sm font-semibold ${getTextColor(
                  color
                )} transition-all duration-200 ${
                  copiedIndex === index ? "scale-110" : ""
                }`}
              >
                {copiedIndex === index ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Copied!
                  </div>
                ) : (
                  colorValue
                )}
              </span>
              <button
                className="p-2 hover:bg-black/10 dark:hover:bg-white/20 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(colorValue, index);
                }}
              >
                <svg
                  className={`w-5 h-5 ${getTextColor(color)}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
