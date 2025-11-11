"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const baseUrl = "https://www.pokemonpalette.com";
  
  // Build structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `${baseUrl}${item.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <nav
        aria-label="Breadcrumb"
        className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}
      >
        <ol className="flex items-center space-x-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.href} className="flex items-center">
                {index === 0 && item.href === "/" ? (
                  <Link
                    href={item.href}
                    className="flex items-center hover:text-foreground transition-colors"
                    aria-label="Home"
                  >
                    <Home className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    {isLast ? (
                      <span className="text-foreground font-medium" aria-current="page">
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className="hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </>
                )}
                {!isLast && (
                  <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

