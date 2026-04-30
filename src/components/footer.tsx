"use client";

import Link from "next/link";
import { Github, Linkedin } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
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
              <span className="text-muted-foreground text-sm">{year}</span>
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
                href="https://x.com/yassenshopov"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (opens in new tab)"
                className="text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <XIcon className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/yassenshopov"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub (opens in new tab)"
                className="text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Github className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                href="https://linkedin.com/in/yassenshopov"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn (opens in new tab)"
                className="text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
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
