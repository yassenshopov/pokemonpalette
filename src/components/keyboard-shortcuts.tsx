"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { startThemeTransition } from "@/lib/theme-transition";

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
      // Bail out for any keypress where the focused element accepts
      // text input. Otherwise Ctrl+B inside a contenteditable rich
      // editor (e.g. for "bold") would fire our sidebar toggle, and
      // Ctrl+Shift+L inside an `<input>` would silently swap themes
      // from under the user's typing flow. The check covers the
      // standard form fields plus contenteditable surfaces and any
      // ARIA-tagged editable widgets (e.g. role="textbox" combobox
      // inputs in some libraries).
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox";
        if (isEditable) return;
      }

      // Theme toggle: Ctrl + Shift + L
      if (event.ctrlKey && event.shiftKey && event.key === "L") {
        event.preventDefault();
        startThemeTransition(() =>
          setTheme(theme === "dark" ? "light" : "dark"),
        );
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
