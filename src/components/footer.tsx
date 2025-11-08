"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t">
      <div className="w-full px-4 md:px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Branding and Description */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
              <h3 className="text-lg md:text-xl font-bold text-foreground">
                Pokemon Palette
              </h3>
              <span className="text-muted-foreground hidden sm:inline">|</span>
              <span className="text-muted-foreground text-sm">2025</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate beautiful color palettes from Pokemon artwork. Free
              design tool for artists, designers, and Pokemon fans.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Not affiliated with &apos;The Pokémon Company&apos; or Nintendo.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 md:mb-3">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Palette Generator
                </Link>
              </li>
              <li>
                <Link
                  href="/game"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Color Game
                </Link>
              </li>
            </ul>
          </div>

          {/* Help & Support */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 md:mb-3">
              Help & Support
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="https://github.com/yassenshopov/pokemonpalette/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Report an Issue
                </Link>
              </li>
              <li>
                <Link
                  href="https://buymeacoffee.com/yassenshopov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Buy Me a Coffee
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 md:mb-3">
              Connect
            </h4>
            <div className="flex space-x-3 mb-4">
              <Link
                href="https://twitter.com/yassenshopov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/yassenshopov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </Link>
              <Link
                href="https://linkedin.com/in/yassenshopov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Linkedin className="h-5 w-5" />
              </Link>
            </div>
            <ul className="space-y-2">
              <li>
                <Link
                  href="https://github.com/yassenshopov/pokemonpalette"
                  target="_blank"
                  rel="noopener noreferrer"
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
      </div>
    </footer>
  );
}
