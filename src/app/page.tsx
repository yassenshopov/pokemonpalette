import { HomeClient } from "@/components/home-client";
import { SEOContent } from "@/components/seo-content";

// Server Component - provides SEO benefits
// All interactivity is handled by HomeClient component
export default function Home() {
  return (
    <>
      <SEOContent type="home" />
      <HomeClient />
    </>
  );
}
