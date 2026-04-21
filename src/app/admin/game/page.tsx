import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminGameDataTab } from "@/components/admin-game-data-tab";

export const metadata = {
  title: "Game Data · Admin · PokémonPalette",
};

export default function AdminGamePage() {
  return (
    <>
      <AdminPageHeader
        title="Game Data"
        description="Daily game attempts, win rates, and player history."
        breadcrumbs={[{ label: "Game Data" }]}
      />
      <div className="p-4 sm:p-6">
        <AdminGameDataTab />
      </div>
    </>
  );
}
