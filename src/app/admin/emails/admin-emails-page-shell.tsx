"use client";

import { useCallback, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmailsTab } from "@/components/admin-emails-tab";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminEmailsPageShell() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTick((tick) => tick + 1);
    setTimeout(() => setRefreshing(false), 450);
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Emails"
        description="Compose and send transactional emails to selected users."
        breadcrumbs={[{ label: "Emails" }]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-2 size-4", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        <AdminEmailsTab
          refreshSignal={refreshTick}
          hideInternalRefresh
        />
      </div>
    </>
  );
}
