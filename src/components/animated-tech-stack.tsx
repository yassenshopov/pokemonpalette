"use client";

import Image from "next/image";

interface TechBadge {
  name: string;
  icon: string;
  href: string;
  alt: string;
}

const techStack: TechBadge[] = [
  {
    name: "Next.js 15",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg",
    href: "https://nextjs.org",
    alt: "Next.js",
  },
  {
    name: "Tailwind CSS",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg",
    href: "https://tailwindcss.com",
    alt: "Tailwind CSS",
  },
  {
    name: "shadcn/ui",
    icon: "https://avatars.githubusercontent.com/u/139895814?v=4",
    href: "https://ui.shadcn.com",
    alt: "shadcn/ui",
  },
  {
    name: "Clerk Auth",
    icon: "https://ph-files.imgix.net/297bc3d4-bd2e-4eaa-8fb6-a289cf61ea91.png?auto=format",
    href: "https://clerk.com",
    alt: "Clerk Auth",
  },
  {
    name: "Supabase",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg",
    href: "https://supabase.com",
    alt: "Supabase",
  },
  {
    name: "Prisma",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/prisma/prisma-original.svg",
    href: "https://prisma.io",
    alt: "Prisma",
  },
];

function TechBadge({ badge }: { badge: TechBadge }) {
  return (
    <a
      href={badge.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-sm px-6 py-3 rounded-lg bg-card border-2 border-gray-600 text-foreground font-semibold hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgb(75,85,99)] hover:shadow-[1px_1px_0px_0px_rgb(75,85,99)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-200 whitespace-nowrap min-w-[140px] justify-center"
    >
      <Image
        src={badge.icon}
        alt={badge.alt}
        width={16}
        height={16}
        className="h-4 w-4 mr-2"
        unoptimized
      />
      {badge.name}
    </a>
  );
}

function ScrollingRow({
  badges,
  direction,
}: {
  badges: TechBadge[];
  direction: "left" | "right";
}) {
  const animationClass =
    direction === "left" ? "animate-scroll-left" : "animate-scroll-right";

  return (
    <div className="relative overflow-x-hidden overflow-y-visible max-w-[500px] mx-auto h-[60px]">
      {/* Fade gradients */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      {/* Scrolling content */}
      <div className={`flex gap-6 items-center h-full ${animationClass}`}>
        {/* Duplicate badges for seamless loop */}
        {badges.map((badge, index) => (
          <TechBadge key={`first-${index}`} badge={badge} />
        ))}
        {badges.map((badge, index) => (
          <TechBadge key={`second-${index}`} badge={badge} />
        ))}
        {badges.map((badge, index) => (
          <TechBadge key={`third-${index}`} badge={badge} />
        ))}
      </div>
    </div>
  );
}

export function AnimatedTechStack() {
  // Split badges into two rows
  const row1 = techStack.slice(0, 3);
  const row2 = techStack.slice(3);

  return (
    <div className="space-y-6 py-4">
      <ScrollingRow badges={row1} direction="left" />
      <ScrollingRow badges={row2} direction="right" />
    </div>
  );
}
