import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AttemptDetailPage } from "@/components/admin/attempt-detail-page";

export const metadata: Metadata = {
  title: "Attempt · Admin · PokémonPalette",
};

export default async function AdminAttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminPageHeader
        title="Game attempt"
        description="Guess-by-guess breakdown and player info."
        breadcrumbs={[
          { label: "Game", href: "/admin/game" },
          { label: id.length > 12 ? `${id.slice(0, 8)}…` : id },
        ]}
      />
      <div className="p-4 sm:p-6">
        <AttemptDetailPage id={id} />
      </div>
    </>
  );
}
