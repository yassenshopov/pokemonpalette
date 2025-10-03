"use client";

import { UserProfile } from "./user-profile";

interface UserProfileWrapperProps {
  isCollapsed?: boolean;
}

export function UserProfileWrapper({
  isCollapsed = false,
}: UserProfileWrapperProps) {
  // Simply pass through to UserProfile - it now handles Clerk availability internally
  return <UserProfile isCollapsed={isCollapsed} />;
}
