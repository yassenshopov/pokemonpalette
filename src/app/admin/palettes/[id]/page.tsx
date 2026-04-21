import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PaletteDetailPage } from "@/components/admin/palette-detail-page";

export const metadata: Metadata = {
  title: "Palette · Admin · PokémonPalette",
};

export default async function AdminPaletteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminPageHeader
        title="Palette"
        description="Colors, owner, and related palettes."
        breadcrumbs={[
          { label: "Palettes", href: "/admin/palettes" },
          { label: id.length > 12 ? `${id.slice(0, 8)}…` : id },
        ]}
      />
      <div className="p-4 sm:p-6">
        <PaletteDetailPage id={id} />
      </div>
    </>
  );
}
