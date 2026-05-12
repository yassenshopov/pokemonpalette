"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

interface AdminShellProps {
  children: React.ReactNode;
  /**
   * Initial expanded/collapsed state, typically read from the
   * `sidebar_state` cookie in the admin layout so the sidebar renders with
   * the correct width on first paint and no hydration flash.
   */
  defaultOpen?: boolean;
}

export function AdminShell({ children, defaultOpen = true }: AdminShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
