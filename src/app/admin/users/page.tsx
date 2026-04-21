import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUsersTab } from "@/components/admin-users-tab";

export const metadata = {
  title: "Users · Admin · PokémonPalette",
};

export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Browse, inspect, and manage every registered account."
        breadcrumbs={[{ label: "Users" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminUsersTab />
      </div>
    </>
  );
}
