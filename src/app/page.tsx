import { cookies } from "next/headers";
import { HomeClient } from "@/components/home-client";
import { SEOContent } from "@/components/seo-content";
import {
  POKEMON_MENU_COOKIE_NAME,
  parsePokemonMenuCookie,
} from "@/lib/pokemon-menu-cookie";

// Server Component - provides SEO benefits
// All interactivity is handled by HomeClient component
export default async function Home() {
  // Reading the menu cookie on the server lets HomeClient seed its
  // useState with the correct collapsed/expanded value on first
  // paint — no more "render expanded, snap to collapsed one frame
  // later" hydration flash for returning visitors who'd previously
  // closed the menu.
  const cookieStore = await cookies();
  const initialMenuCollapsed = parsePokemonMenuCookie(
    cookieStore.get(POKEMON_MENU_COOKIE_NAME)?.value,
  );

  return (
    <>
      <SEOContent type="home" />
      <HomeClient initialMenuCollapsed={initialMenuCollapsed} />
    </>
  );
}
