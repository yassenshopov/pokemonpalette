"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserDetailLoader } from "@/components/admin/user-detail";

interface UserLite {
  id: string;
}

interface UserSheetProps {
  user: UserLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSheet({ user, open, onOpenChange }: UserSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-6 sm:max-w-2xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>User details</SheetTitle>
          <SheetDescription>
            Inspect account info, recent activity, and take admin actions.
          </SheetDescription>
        </SheetHeader>
        {user ? (
          <UserDetailLoader
            userId={user.id}
            variant="sheet"
            onUserDeleted={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
