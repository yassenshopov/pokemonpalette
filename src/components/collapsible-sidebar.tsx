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
  Gamepad2,
  Compass,
  Code,
  User,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfile } from "@/components/user-profile";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Coffee } from "lucide-react";
import { getContrastTextClass as getTextColor } from "@/lib/game/colors";
import { useSidebarState } from "@/components/sidebar-state-provider";

interface CollapsibleSidebarProps {
  primaryColor?: string;
}

export function CollapsibleSidebar({ primaryColor }: CollapsibleSidebarProps) {
  // Collapsed state is provided by the root layout (cookie-backed) so it
  // persists across route changes and sessions without a hydration flash.
  const { isCollapsed, toggleCollapsed: handleSidebarToggle } =
    useSidebarState();
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
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" aria-hidden="true" />
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
                    <Gamepad2 className="h-4 w-4" />
                    <span>Game</span>
                  </Link>
                  <Link
                    href="/explore"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Compass className="h-4 w-4" />
                    <span>Explore</span>
                  </Link>
                  <Link
                    href="/saved-palettes"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>Saved Palettes</span>
                  </Link>
                  <Link
                    href="/api-access"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Code className="h-4 w-4" />
                    <span>API</span>
                  </Link>
                  <Link
                    href="/account"
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Account</span>
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
              <UserProfile />
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
                    Support the project
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
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
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
                      <Gamepad2 className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/explore"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="Explore"
                    >
                      <Compass className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/saved-palettes"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="Saved Palettes"
                    >
                      <Bookmark className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/api-access"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="API"
                    >
                      <Code className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/account"
                      className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      title="Account"
                    >
                      <User className="h-4 w-4" />
                    </Link>
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
                      title="Support the project"
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
                      <Gamepad2 className="h-4 w-4" />
                      <span>Game</span>
                    </Link>
                    <Link
                      href="/explore"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <Compass className="h-4 w-4" />
                      <span>Explore</span>
                    </Link>
                    <Link
                      href="/saved-palettes"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <Bookmark className="h-4 w-4" />
                      <span>Saved Palettes</span>
                    </Link>
                    <Link
                      href="/api-access"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <Code className="h-4 w-4" />
                      <span>API</span>
                    </Link>
                    <Link
                      href="/account"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <User className="h-4 w-4" />
                      <span>Account</span>
                    </Link>
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
            <UserProfile isCollapsed={isCollapsed} />
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
                    Support the project
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
