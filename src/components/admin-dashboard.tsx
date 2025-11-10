"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminUsersTab } from "@/components/admin-users-tab";
import { AdminGameDataTab } from "@/components/admin-game-data-tab";
import { AdminSavedPalettesTab } from "@/components/admin-saved-palettes-tab";
import { AdminEmailsTab } from "@/components/admin-emails-tab";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="container mx-auto p-6 space-y-6 mt-12">
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="game-data">Game Data</TabsTrigger>
          <TabsTrigger value="saved-palettes">Saved Palettes</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <AdminUsersTab />
        </TabsContent>

        <TabsContent value="game-data" className="mt-6">
          <AdminGameDataTab />
        </TabsContent>

        <TabsContent value="saved-palettes" className="mt-6">
          <AdminSavedPalettesTab />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <AdminEmailsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

