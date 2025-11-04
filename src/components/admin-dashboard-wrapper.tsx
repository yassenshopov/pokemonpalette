"use client";

import { AdminDashboard } from "@/components/admin-dashboard";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";

interface AdminDashboardWrapperProps {
  primaryColor?: string;
}

export function AdminDashboardWrapper({ primaryColor = "#3b82f6" }: AdminDashboardWrapperProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor={primaryColor} />
      <CollapsibleSidebar primaryColor={primaryColor} />
      <div className="flex-1 flex flex-col h-full overflow-auto">
        <AdminDashboard />
        <Footer />
      </div>
    </div>
  );
}

