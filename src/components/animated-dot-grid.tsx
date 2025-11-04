"use client";

import { type ColorWithFrequency } from "@/lib/color-extractor";

interface AnimatedDotGridProps {
  colors: ColorWithFrequency[];
  className?: string;
}

export function AnimatedDotGrid({ colors, className = "" }: AnimatedDotGridProps) {
  // Extract color hex values, or use a default subtle color
  const dotColors = colors.length > 0 
    ? colors.map((c) => c.hex)
    : ["#f59e0b"]; // Default fallback

  // Generate dots with varying sizes and delays for animation
  const dotSize = 3;
  const gap = 48;
  const dotCount = 25; // Number of dots per row/column

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Base grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
          backgroundSize: `${gap}px ${gap}px`,
          backgroundPosition: "0 0",
          opacity: 0.08,
          color: dotColors[0] || "#f59e0b",
        }}
      />
      {/* Animated dots overlay with color variation */}
      <div className="absolute inset-0">
        {Array.from({ length: dotCount * dotCount }).map((_, index) => {
          const row = Math.floor(index / dotCount);
          const col = index % dotCount;
          const colorIndex = index % dotColors.length;
          const x = (col * gap) + gap / 2;
          const y = (row * gap) + gap / 2;
          const delay = (index % 7) * 0.15 + (Math.floor(index / dotCount) % 7) * 0.15;
          
          return (
            <div
              key={index}
              className="dot-grid-pulse absolute rounded-full"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                backgroundColor: dotColors[colorIndex],
                opacity: 0.15,
                transform: "translate(-50%, -50%)",
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>
      
      {/* Subtle radial gradient in top-right corner */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${dotColors[0] || "#f59e0b"} 0%, transparent 70%)`,
          opacity: 0.35,
          transform: "translate(30%, -30%)",
        }}
      />
    </div>
  );
}

