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
  async headers() {
    // Our Pokemon sprite PNGs in /public/pokemon/** are deterministic and
    // effectively immutable (filename = pokemon id). Tell browsers to cache
    // them for a year so repeat visits don't hit the edge at all.
    return [
      {
        source: "/pokemon/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
