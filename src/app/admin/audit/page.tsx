import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminAuditTab } from "@/components/admin/admin-audit-tab";

export const metadata = {
  title: "Audit Log · Admin · PokémonPalette",
};

export default function AdminAuditPage() {
  return (
    <>
      <AdminPageHeader
        title="Audit Log"
        description="Every privileged admin action: who did what, when, and to which row."
        breadcrumbs={[{ label: "Audit Log" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminAuditTab />
      </div>
    </>
  );
}
