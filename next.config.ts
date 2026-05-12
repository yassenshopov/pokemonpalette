import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/PokeAPI/sprites/**",
      },
    ],
  },

  // Tree-shake large icon / radix packages so route chunks only pull the
  // exports they actually use instead of the whole barrel. This cuts the
  // per-page JS payload noticeably for pages that import `lucide-react` and
  // `@radix-ui/*` (most of the UI).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "date-fns",
      "recharts",
    ],
  },

  // Redirects consolidate Googlebot's crawl onto a single canonical URL per
  // resource. Search Console was reporting hundreds of "Crawled - currently
  // not indexed" entries for non-canonical variants (apex host, /blog 404,
  // legacy ?pokemon= query strings) — each of these rules turns one of those
  // into a hard 308 so Google can collapse them onto the real URL.
  async redirects() {
    return [
      {
        // Apex domain -> www. Tells Google there's exactly one canonical host
        // and removes the duplicate `pokemonpalette.com/...` entries from GSC.
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "pokemonpalette.com",
          },
        ],
        destination: "https://www.pokemonpalette.com/:path*",
        permanent: true,
      },
      {
        // /blog and /blog/* don't exist (we don't run a blog yet). Google has
        // crawled them anyway; a 308 to the home page is a stronger signal
        // than a soft-404 and lets it drop the URL from the index.
        source: "/blog/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "/",
        permanent: true,
      },
      {
        // Legacy SPA URL pattern: ?pokemon=trapinch -> /trapinch. Send these
        // to the canonical Pokemon route so any inbound links consolidate
        // signals onto the indexable page.
        source: "/",
        has: [
          {
            type: "query",
            key: "pokemon",
            value: "(?<name>.+)",
          },
        ],
        destination: "/:name",
        permanent: true,
      },
    ];
  },

  // Disable the `X-Powered-By: Next.js` header. There's no operational
  // value in advertising the framework + version to attackers — it just
  // narrows their CVE search.
  poweredByHeader: false,

  async headers() {
    return [
      {
        // BASELINE security headers applied to every response. Specific
        // routes can layer additional headers below (e.g. Cache-Control
        // on /pokemon/*). These exist to close the gaps surfaced by
        // the security audit (clickjacking, MIME sniffing, missing
        // HSTS, leaky referrers, unrestricted browser features).
        //
        // CSP intentionally only locks down `frame-ancestors` for now —
        // a strict `script-src` / `style-src` policy with nonces needs
        // middleware-level wiring to issue nonces per request, and
        // misconfiguring it bricks the entire app. `frame-ancestors`
        // is the modern replacement for X-Frame-Options and is the
        // single most important directive for the admin clickjacking
        // risk called out in the audit. Both headers are emitted for
        // belt-and-braces support of legacy user agents.
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            // 2 years + subdomains + preload-eligible.
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Lock down powerful browser features we never use. Saves
            // accidental exposure if a third-party script tries to
            // probe geolocation / camera / etc.
            key: "Permissions-Policy",
            value:
              "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), sync-xhr=(), usb=(), screen-wake-lock=(), web-share=(self), xr-spatial-tracking=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
      {
        // Per-Pokemon sprite PNGs under /public/pokemon/** are deterministic
        // (filename = pokemon id / form); cache aggressively. Immutable means
        // browsers skip revalidation on repeat visits, the single biggest
        // perf win for returning users.
        source: "/pokemon/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Per-Pokemon data JSON files under /public/data/pokemon/**. Same
        // deterministic-by-id pattern — filename encodes the id, and file
        // contents only change when we ship a new build.
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // OG image endpoints are referenced from every Pokemon page's
        // <meta property="og:image">. They must stay crawlable (robots.txt
        // explicitly Allows /api/og/) so social platforms can fetch them,
        // but we don't want the raw 1200x675 PNGs showing up as standalone
        // results in Google Image Search — they only make sense in the
        // context of the page they belong to. X-Robots-Tag: noindex lets
        // crawlers fetch the asset but keeps it out of the index.
        source: "/api/og/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
      {
        // /opengraph-image and /twitter-image are Next.js file conventions
        // (src/app/opengraph-image.tsx, src/app/twitter-image.tsx) that emit
        // the root-level social preview images. They were showing up in GSC
        // as "Crawled - currently not indexed" because Google discovered the
        // URLs in the home page's og:image / twitter:image meta. Same
        // reasoning as /api/og/*: keep them crawlable, but don't index the
        // raw PNGs as standalone results.
        source: "/opengraph-image",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
      {
        source: "/twitter-image",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
