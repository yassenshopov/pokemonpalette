"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type ColorblindType =
  | "none"
  | "protanopia" // Red-blind
  | "deuteranopia" // Green-blind
  | "tritanopia" // Blue-blind
  | "protanomaly" // Red-weak
  | "deuteranomaly" // Green-weak
  | "tritanomaly" // Blue-weak
  | "achromatopsia"; // Complete color blindness

interface ColorblindContextType {
  colorblindType: ColorblindType;
  setColorblindType: (type: ColorblindType) => void;
}

const ColorblindContext = createContext<ColorblindContextType | undefined>(
  undefined
);

// CSS filter matrices for different types of colorblindness
// These are based on research from colorblind.org and other accessibility resources
const colorblindFilters: Record<ColorblindType, string> = {
  none: "none",
  protanopia:
    "url(#protanopia-filter)",
  deuteranopia:
    "url(#deuteranopia-filter)",
  tritanopia:
    "url(#tritanopia-filter)",
  protanomaly:
    "url(#protanomaly-filter)",
  deuteranomaly:
    "url(#deuteranomaly-filter)",
  tritanomaly:
    "url(#tritanomaly-filter)",
  achromatopsia:
    "url(#achromatopsia-filter)",
};

export function ColorblindProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [colorblindType, setColorblindTypeState] =
    useState<ColorblindType>("none");
  const [mounted, setMounted] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("colorblind-type");
    if (saved && saved in colorblindFilters) {
      setColorblindTypeState(saved as ColorblindType);
    }
  }, []);

  // Save preference to localStorage
  const setColorblindType = (type: ColorblindType) => {
    setColorblindTypeState(type);
    localStorage.setItem("colorblind-type", type);
  };

  return (
    <ColorblindContext.Provider value={{ colorblindType, setColorblindType }}>
      {/* SVG filters for colorblindness simulation */}
      <svg
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          {/* Protanopia - Red-blind */}
          <filter id="protanopia-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.567 0.433 0 0 0
                      0.558 0.442 0 0 0
                      0 0.242 0.758 0 0
                      0 0 0 1 0"
            />
          </filter>

          {/* Deuteranopia - Green-blind */}
          <filter id="deuteranopia-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.625 0.375 0 0 0
                      0.7 0.3 0 0 0
                      0 0.142 0.858 0 0
                      0 0 0 1 0"
            />
          </filter>

          {/* Tritanopia - Blue-blind */}
          <filter id="tritanopia-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.95 0.05 0 0 0
                      0 0.433 0.567 0 0
                      0.142 0.858 0 0 0
                      0 0 0 1 0"
            />
          </filter>

          {/* Protanomaly - Red-weak */}
          <filter id="protanomaly-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.817 0.183 0 0 0
                      0.333 0.667 0 0 0
                      0 0.125 0.875 0 0
                      0 0 0 1 0"
            />
          </filter>

          {/* Deuteranomaly - Green-weak */}
          <filter id="deuteranomaly-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.8 0.2 0 0 0
                      0.258 0.742 0 0 0
                      0 0.142 0.858 0 0
                      0 0 0 1 0"
            />
          </filter>

          {/* Tritanomaly - Blue-weak */}
          <filter id="tritanomaly-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.967 0.033 0 0 0
                      0 0.733 0.267 0 0
                      0 0.183 0.817 0 0
                      0 0 0 1 0"
            />
          </filter>

          {/* Achromatopsia - Complete color blindness (grayscale) */}
          <filter id="achromatopsia-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.299 0.587 0.114 0 0
                      0.299 0.587 0.114 0 0
                      0.299 0.587 0.114 0 0
                      0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          filter:
            colorblindType === "none"
              ? "none"
              : colorblindFilters[colorblindType],
          minHeight: "100%",
        }}
      >
        {children}
      </div>
    </ColorblindContext.Provider>
  );
}

export function useColorblind() {
  const context = useContext(ColorblindContext);
  if (context === undefined) {
    throw new Error("useColorblind must be used within a ColorblindProvider");
  }
  return context;
}

