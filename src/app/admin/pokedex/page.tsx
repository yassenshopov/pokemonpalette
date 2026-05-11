import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPokedex } from "@/components/admin/admin-pokedex";

export const metadata = {
  title: "Pokédex · Admin · PokémonPalette",
};

export default function AdminPokedexPage() {
  return (
    <>
      <AdminPageHeader
        title="Pokédex"
        description="Who's catching what — total catches, top species, recent activity, and shiny / mode breakdown."
        breadcrumbs={[{ label: "Pokédex" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminPokedex />
      </div>
    </>
  );
}
