import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmailsTab } from "@/components/admin-emails-tab";

export const metadata = {
  title: "Emails · Admin · PokémonPalette",
};

export default function AdminEmailsPage() {
  return (
    <>
      <AdminPageHeader
        title="Emails"
        description="Compose and send transactional emails to selected users."
        breadcrumbs={[{ label: "Emails" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminEmailsTab />
      </div>
    </>
  );
}
