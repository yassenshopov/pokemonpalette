import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminColorManagementTab } from "@/components/admin-color-management-tab";

export const metadata = {
  title: "Color Management · Admin · PokémonPalette",
};

export default function AdminColorsPage() {
  return (
    <>
      <AdminPageHeader
        title="Color Management"
        description="Extract, review, and update canonical colors for every Pokémon."
        breadcrumbs={[{ label: "Color Management" }]}
      />
      <div className="p-4 sm:p-6">
        <Suspense
          fallback={
            <div
              className="text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              Loading workbench…
            </div>
          }
        >
          <AdminColorManagementTab />
        </Suspense>
      </div>
    </>
  );
}
