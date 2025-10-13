"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileWrapper } from "@/components/user-profile-wrapper";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export function CollapsibleSidebar() {
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
                  alt="Starter Yeast logo"
                  width={80}
                  height={20}
                  className="dark:invert"
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Appearance</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t">
              <UserProfileWrapper />
              <div className="p-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  Starter Yeast v0.1.0
                </p>
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
                alt="Starter Yeast logo"
                width={isCollapsed ? 28 : 36}
                height={isCollapsed ? 28 : 9}
                className="dark:invert"
                unoptimized
              />
              {!isCollapsed && (
                <span className="text-lg font-semibold text-foreground font-sans">
                  StarterYeast
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
            <div className="space-y-4">
              {isCollapsed ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex flex-col items-center">
                    <ThemeToggle />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Appearance</span>
                  <ThemeToggle />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t">
            <UserProfileWrapper isCollapsed={isCollapsed} />
            {!isCollapsed && (
              <div className="p-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  Starter Yeast v0.1.0
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
