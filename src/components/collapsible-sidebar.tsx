"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Home,
  Bookmark,
  Target,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileWrapper } from "@/components/user-profile-wrapper";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SavedPalettesDialog } from "@/components/saved-palettes-dialog";
import { Coffee } from "lucide-react";

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): "text-white" | "text-black" => {
  if (!hex) return "text-white";
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "text-black" : "text-white";
};

interface CollapsibleSidebarProps {
  primaryColor?: string;
  onPaletteLoad?: (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => void;
}

export function CollapsibleSidebar({
  primaryColor,
  onPaletteLoad,
}: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSidebarToggle = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    } else {
      // Default to collapsed if no saved state
      setIsCollapsed(true);
    }
  }, []);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      handleSidebarToggle();
    }
  };

  // Mobile: Show overlay sidebar
  if (isMobile) {
    return (
      <>
        <KeyboardShortcuts
          onSidebarToggle={handleSidebarToggle}
          isMobile={isMobile}
        />
        {/* Mobile Menu Button */}
        {!isMobileOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="fixed top-4 right-4 z-50 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={toggleSidebar}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={`fixed top-0 right-0 h-full bg-background border-l transition-transform duration-300 ease-in-out z-40 ${
            isMobileOpen ? "translate-x-0" : "translate-x-full"
          } w-64`}
        >
          <div className="flex flex-col h-full">
            {/* Header with Logo */}
            <div className="flex items-center justify-between p-4 border-b">
              <Link href="/" className="flex items-center space-x-2">
                <Image
                  src="/logo.png"
                  alt="PokémonPalette logo"
                  width={48}
                  height={12}
                  unoptimized
                />
              </Link>

              {/* Close Button */}
              <Button variant="ghost" size="sm" onClick={toggleSidebar}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 p-4">
              <div className="space-y-6">
                {/* Navigation */}
                <div className="space-y-2">
                  <Link
                    href="/"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                  <Link
                    href="/game"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Target className="h-4 w-4" />
                    <span>Game</span>
                  </Link>
                  <Link
                    href="/explore"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Explore</span>
                  </Link>
                </div>

                {/* Appearance */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Appearance</span>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t">
              <UserProfileWrapper />
              <div className="p-4 pt-2 space-y-3">
                {/* Coffee CTA */}
                <a
                  href="https://buymeacoffee.com/yassenshopov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    size="sm"
                    className="w-full border-0 cursor-pointer font-medium transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: primaryColor || "#f59e0b",
                      color:
                        getTextColor(primaryColor || "#f59e0b") === "text-white"
                          ? "#ffffff"
                          : "#000000",
                    }}
                  >
                    <Coffee className="w-4 h-4 mr-2" />
                    Buy Me a Coffee!
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop: Show regular sidebar
  return (
    <>
      <KeyboardShortcuts
        onSidebarToggle={handleSidebarToggle}
        isMobile={isMobile}
      />
      <div
        className={`bg-background border-r transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header with Logo */}
          <div
            className={`flex items-center border-b ${
              isCollapsed ? "flex-col pt-6 pb-2 px-2" : "justify-between p-4"
            }`}
          >
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="PokémonPalette logo"
                width={isCollapsed ? 28 : 36}
                height={isCollapsed ? 28 : 9}
                unoptimized
              />
              {!isCollapsed && (
                <span className="text-lg font-semibold text-foreground font-heading">
                  PokémonPalette
                </span>
              )}
            </Link>

            {/* Collapse/Expand Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className={isCollapsed ? "mt-4" : "ml-auto"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 p-4">
            <div className="space-y-6">
              {isCollapsed ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex flex-col items-center space-y-2">
                    <Link
                      href="/"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="Home"
                    >
                      <Home className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/game"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="Game"
                    >
                      <Target className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/explore"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="Explore"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="flex flex-col items-center">
                    <SavedPalettesDialog
                      onPaletteSelect={onPaletteLoad}
                      isCollapsed={true}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                          title="Saved Palettes"
                        >
                          <Bookmark className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <ThemeToggle />
                  </div>
                  <div className="flex flex-col items-center">
                    <a
                      href="https://buymeacoffee.com/yassenshopov"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{
                        backgroundColor: primaryColor || "#f59e0b",
                        color:
                          getTextColor(primaryColor || "#f59e0b") ===
                          "text-white"
                            ? "#ffffff"
                            : "#000000",
                      }}
                      title="Buy Me a Coffee"
                    >
                      <Coffee className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {/* Navigation */}
                  <div className="space-y-2">
                    <Link
                      href="/"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <Home className="h-4 w-4" />
                      <span>Home</span>
                    </Link>
                    <Link
                      href="/game"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <Target className="h-4 w-4" />
                      <span>Game</span>
                    </Link>
                    <Link
                      href="/explore"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Explore</span>
                    </Link>
                    <SavedPalettesDialog
                      onPaletteSelect={onPaletteLoad}
                      trigger={
                        <Button
                          variant="ghost"
                          className="w-full justify-start px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                        >
                          <Bookmark className="h-4 w-4 mr-3" />
                          <span>Saved Palettes</span>
                        </Button>
                      }
                    />
                  </div>

                  {/* Appearance */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Appearance</span>
                      <ThemeToggle />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t">
            <UserProfileWrapper isCollapsed={isCollapsed} />
            {!isCollapsed && (
              <div className="p-4 pt-2 space-y-3">
                {/* Coffee CTA */}
                <a
                  href="https://buymeacoffee.com/yassenshopov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    size="sm"
                    className="w-full border-0 cursor-pointer font-medium transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: primaryColor || "#f59e0b",
                      color:
                        getTextColor(primaryColor || "#f59e0b") === "text-white"
                          ? "#ffffff"
                          : "#000000",
                    }}
                  >
                    <Coffee className="w-4 h-4 mr-2" />
                    Buy Me a Coffee!
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
