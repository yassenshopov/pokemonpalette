import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSavedPalettesTab } from "@/components/admin-saved-palettes-tab";

export const metadata = {
  title: "Saved Palettes · Admin · PokémonPalette",
};

export default function AdminPalettesPage() {
  return (
    <>
      <AdminPageHeader
        title="Saved Palettes"
        description="Every palette users have saved, searchable by Pokémon and owner."
        breadcrumbs={[{ label: "Saved Palettes" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminSavedPalettesTab />
      </div>
    </>
  );
}
