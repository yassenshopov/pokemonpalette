import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminInsights } from "@/components/admin/admin-insights";

export const metadata = {
  title: "Insights · Admin · PokémonPalette",
};

export default function AdminInsightsPage() {
  return (
    <>
      <AdminPageHeader
        title="Insights"
        description="Visual growth story for daily plays and saved palettes — cumulative trends, a yearly activity heatmap, and a Pokédex engagement map."
        breadcrumbs={[{ label: "Insights" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminInsights />
      </div>
    </>
  );
}
