"use client";

import { useUser, SignInButton, SignOutButton, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface UserProfileProps {
  isCollapsed?: boolean;
}

// Component that handles Clerk hooks - only rendered when Clerk is available
function ClerkUserProfile({ isCollapsed = false }: UserProfileProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div
        className={`flex items-center ${
          isCollapsed ? "justify-center p-2" : "p-2"
        }`}
      >
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-2">
        <SignInButton mode="modal">
          <Button
            variant="outline"
            size="sm"
            className={isCollapsed ? "w-8 h-8 p-0" : "w-full"}
          >
            {isCollapsed ? (
              <User className="h-4 w-4" />
            ) : (
              <>
                <User className="h-4 w-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className={`p-2 ${isCollapsed ? "flex justify-center" : ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`${
              isCollapsed
                ? "w-8 h-8 p-0 justify-center cursor-pointer"
                : "w-full justify-start p-2 h-auto"
            }`}
          >
            {isCollapsed ? (
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                />
                <AvatarFallback className="text-xs">
                  {user.firstName?.[0] || ""}
                  {user.lastName?.[0] || ""}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex items-center space-x-3 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={user.imageUrl}
                    alt={user.fullName || "User"}
                  />
                  <AvatarFallback>
                    {user.firstName?.[0] || ""}
                    {user.lastName?.[0] || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {user.fullName || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.primaryEmailAddress?.emailAddress || ""}
                  </p>
                </div>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href="/account" className="w-full">
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Account Settings
              </Button>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <SignOutButton>
              <div className="flex items-center">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </div>
            </SignOutButton>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Main component that checks for Clerk availability
function UserProfileClient({ isCollapsed = false }: UserProfileProps) {
  // Check if Clerk is available first
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <div className="p-2">
        <Button
          variant="outline"
          size="sm"
          disabled
          className={`bg-muted text-muted-foreground ${
            isCollapsed ? "w-8 h-8 p-0" : "w-full"
          }`}
          title="Authentication not configured. Please set up Clerk API keys."
        >
          {isCollapsed ? (
            <User className="h-4 w-4" />
          ) : (
            <>
              <User className="h-4 w-4 mr-2" />
              Auth Disabled
            </>
          )}
        </Button>
      </div>
    );
  }

  // Only render ClerkUserProfile if Clerk is available
  return <ClerkUserProfile isCollapsed={isCollapsed} />;
}

export function UserProfile({ isCollapsed = false }: UserProfileProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        className={`flex items-center ${
          isCollapsed ? "justify-center p-2" : "p-2"
        }`}
      >
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  return <UserProfileClient isCollapsed={isCollapsed} />;
}
