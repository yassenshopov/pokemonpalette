import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminOverview } from "@/components/admin/admin-overview";

export const metadata = {
  title: "Overview · Admin · PokémonPalette",
};

export default function AdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Live snapshot of users, gameplay, and saved palettes."
      />
      <div className="p-4 sm:p-6">
        <AdminOverview />
      </div>
    </>
  );
}
