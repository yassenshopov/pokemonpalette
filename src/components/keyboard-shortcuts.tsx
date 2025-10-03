"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

interface KeyboardShortcutsProps {
  onSidebarToggle: () => void;
  isMobile: boolean;
}

export function KeyboardShortcuts({
  onSidebarToggle,
  isMobile,
}: KeyboardShortcutsProps) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Theme toggle: Ctrl + Shift + L
      if (event.ctrlKey && event.shiftKey && event.key === "L") {
        event.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }

      // Sidebar toggle: Ctrl + B (desktop only)
      if (event.ctrlKey && event.key === "b") {
        event.preventDefault();
        if (!isMobile) {
          onSidebarToggle();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [theme, setTheme, onSidebarToggle, isMobile]);

  return null; // This component doesn't render anything
}
