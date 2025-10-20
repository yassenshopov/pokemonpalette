"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t">
      <div className="w-full px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Branding and Description */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-bold text-foreground">
                Pokemon Palette
              </h3>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">2025</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate beautiful color palettes from Pokemon artwork. Free
              design tool for artists, designers, and Pokemon fans.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Not affiliated with &apos;The Pokémon Company&apos; or Nintendo.
            </p>
          </div>

          {/* Quick Links & Submit Design */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Quick Links
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/palette-generator"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Palette Generator
                  </Link>
                </li>
                <li>
                  <Link
                    href="/color-game"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Color Game
                  </Link>
                </li>
                <li>
                  <Link
                    href="/community"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Explore Community
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Submit Design
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/design-challenges"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Design Challenges
                  </Link>
                </li>
                <li>
                  <Link
                    href="/design-blog"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Design Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="/resources"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Resources
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Help & Support */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Help & Support
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/faq"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/report-issue"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Report an Issue
                </Link>
              </li>
              <li>
                <Link
                  href="/support-project"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Support Project
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Connect
            </h4>
            <div className="flex space-x-3 mb-4">
              <Link
                href="https://twitter.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </Link>
            </div>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/source-code"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Source Code
                </Link>
              </li>
              <li>
                <Link
                  href="https://pokeapi.co"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Powered by PokéAPI
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Copyright */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            © 2025 Pokemon Palette by{" "}
            <span className="font-semibold">Yassen Shopov</span>. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
