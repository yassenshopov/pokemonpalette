import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { UserDetailPage } from "@/components/admin/user-detail-page";

export const metadata: Metadata = {
  title: "User · Admin · PokémonPalette",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminPageHeader
        title="User"
        description="Account details, stats, and admin controls."
        breadcrumbs={[
          { label: "Users", href: "/admin/users" },
          { label: id.length > 12 ? `${id.slice(0, 8)}…` : id },
        ]}
      />
      <div className="p-4 sm:p-6">
        <UserDetailPage userId={id} />
      </div>
    </>
  );
}
