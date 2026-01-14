"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNER_COOKIE_NAME = "legends_za_banner_dismissed";
const BANNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Helper function to get cookie value
const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
};

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string | undefined): string => {
  if (!hex || typeof hex !== "string") {
    return "#000000";
  }

  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
};

interface LegendsZABannerProps {
  primaryColor?: string;
  secondaryColor?: string;
}

export function LegendsZABanner({ 
  primaryColor = "#6366f1", 
}: LegendsZABannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissedCookie = getCookie(BANNER_COOKIE_NAME);
    if (dismissedCookie === "true") {
      setIsDismissed(true);
      return;
    }

    // Trigger enter animation on mount
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isExiting) {
      // Set cookie when dismissing
      document.cookie = `${BANNER_COOKIE_NAME}=true; path=/; max-age=${BANNER_COOKIE_MAX_AGE}`;
      
      // Wait for exit animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 300); // Match the animation duration
      return () => clearTimeout(timer);
    }
  }, [isExiting]);

  const handleDismiss = () => {
    setIsExiting(true);
  };

  if (isDismissed) {
    return null;
  }

  const textColor = getTextColor(primaryColor);

  return (
    <div 
      className={`relative w-full overflow-hidden transition-all duration-300 ease-in-out ${
        isExiting 
          ? "opacity-0 -translate-y-full max-h-0 py-0" 
          : isMounted
          ? "opacity-100 translate-y-0 max-h-20 py-2"
          : "opacity-0 -translate-y-full max-h-0 py-0"
      }`}
      style={{
        backgroundColor: primaryColor,
        color: textColor,
      }}
    >
      <div className="px-4 flex items-center justify-between gap-4">
        <div className="flex-1 text-sm font-heading">
          <span className="font-semibold">New!</span>
          {" "}
          <span className="opacity-90">Mega evolutions from Pokémon Legends Z-A and the DLCs are now available!</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 hover:opacity-70"
          style={{ color: textColor }}
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
