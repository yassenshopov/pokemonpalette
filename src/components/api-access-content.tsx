"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Zap,
  Palette,
  Check,
  Loader2,
  Key,
  Globe,
  Sparkles,
  Paintbrush,
  Copy,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface ApiAccessContentProps {
  hasPurchased: boolean;
}

const BW2_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;

const SHOWCASE_POKEMON = [
  {
    id: 6, name: "Charizard", sprite: BW2_SPRITE(6),
    palette: { primary: "#ee8329", secondary: "#cd5241", accent: "#084152", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 94, name: "Gengar", sprite: BW2_SPRITE(94),
    palette: { primary: "#9473b4", secondary: "#5a4a9c", accent: "#b48bbd", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 1, name: "Bulbasaur", sprite: BW2_SPRITE(1),
    palette: { primary: "#399494", secondary: "#62d5b4", accent: "#73ac31", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 25, name: "Pikachu", sprite: BW2_SPRITE(25),
    palette: { primary: "#f6e652", secondary: "#f6bd20", accent: "#9c5200", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 197, name: "Umbreon", sprite: BW2_SPRITE(197),
    palette: { primary: "#414152", secondary: "#29314a", accent: "#62627b", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 282, name: "Gardevoir", sprite: BW2_SPRITE(282),
    palette: { primary: "#eeeeff", secondary: "#cdcde6", accent: "#8be68b", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 130, name: "Gyarados", sprite: BW2_SPRITE(130),
    palette: { primary: "#41b4ee", secondary: "#208bac", accent: "#ccb47f", bg: "#F8F8F8", text: "#2C2C2C" },
  },
  {
    id: 133, name: "Eevee", sprite: BW2_SPRITE(133),
    palette: { primary: "#a4624a", secondary: "#d59c4a", accent: "#e6c594", bg: "#F8F8F8", text: "#2C2C2C" },
  },
];

const TOC_ITEMS = [
  { id: "features", label: "Features" },
  { id: "palettes", label: "Palettes" },
  { id: "pricing", label: "Pricing" },
  { id: "docs", label: "API Docs" },
  { id: "faq", label: "FAQ" },
];

const FAQ_ITEMS = [
  {
    q: "What format are the colors in?",
    a: "All colors are hex (#RRGGBB). Each palette includes primary, secondary, accent, background, and text. Responses also include a ready-to-use Tailwind config object and CSS custom properties.",
  },
  {
    q: "Is this really lifetime? No catch?",
    a: "Yes. One payment, access forever. No metered billing, no monthly invoices. The data is static (Pok\u00e9mon palettes don\u2019t change) so there\u2019s minimal ongoing cost to serve it.",
  },
  {
    q: "What\u2019s the rate limit?",
    a: "600 requests per minute per API key. Responses are edge-cached with a 24-hour TTL, so in practice most requests are served from the CDN without hitting our servers.",
  },
  {
    q: "Can I use this commercially?",
    a: "Absolutely. Use the palettes in apps, design tools, websites, games \u2014 whatever you\u2019re building. The color data itself isn\u2019t copyrightable.",
  },
  {
    q: "Do you support shiny palettes?",
    a: "Yes. When available, shinyColorPalette is included alongside the regular colorPalette in every response.",
  },
  {
    q: "What if I lose my API key?",
    a: "You can create up to 5 keys and revoke/regenerate them anytime from your account dashboard.",
  },
];

function SwatchStrip({ colors, className = "" }: { colors: string[]; className?: string }) {
  return (
    <div className={`flex rounded-lg overflow-hidden ${className}`}>
      {colors.map((c, i) => (
        <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

function SwatchCard({ name, sprite, palette }: { name: string; sprite: string; palette: typeof SHOWCASE_POKEMON[0]["palette"] }) {
  const colors = [palette.primary, palette.secondary, palette.accent];
  return (
    <div className="group relative rounded-xl border bg-card overflow-hidden transition-all hover:-translate-y-0.5">
      <div className="relative h-24 overflow-hidden">
        <SwatchStrip colors={colors} className="h-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={sprite}
            alt={name}
            width={64}
            height={64}
            className="drop-shadow-[0_0_1px_rgba(0,0,0,0.3)] opacity-20 group-hover:opacity-40 transition-opacity brightness-0 dark:invert"
            unoptimized
          />
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold">{name}</p>
        <div className="flex gap-1.5">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c }} />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PurchaseButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      disabled={loading}
      className="h-12 px-8 text-base font-semibold"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <Sparkles className="w-5 h-5 mr-2" />
      )}
      {loading ? "Redirecting to checkout..." : "Get Lifetime Access \u2014 $29"}
    </Button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function FloatingToc({ activeId }: { activeId: string }) {
  return (
    <nav className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 z-30" aria-label="Table of contents">
      <ul className="space-y-1">
        {TOC_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block text-xs px-3 py-1.5 rounded-md transition-colors ${
                activeId === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const API_ENDPOINTS = [
  {
    id: "list",
    label: "List Palettes",
    method: "GET",
    path: "/api/v1/palettes",
    params: "?type=Fire&format=hex&page=1&pageSize=2",
    desc: "Paginated list. Params: type, generation, format (hex|rgb|hsl), shiny (true), page, pageSize.",
    curl: `curl -H "Authorization: Bearer pkpal_YOUR_KEY" \\
  "https://www.pokemonpalette.com/api/v1/palettes?type=Fire&format=hex&page=1&pageSize=2"`,
    response: `{
  "data": [
    {
      "id": 4, "name": "Charmander",
      "type": ["Fire"], "generation": 1,
      "shiny": false, "colorFormat": "hex",
      "colorPalette": {
        "primary": "#ee7b30", "secondary": "#f6b444",
        "accent": "#843d2c", ...
      },
      "shinyColorPalette": { "primary": "#f6e652", ... },
      "tailwindConfig": { "theme": { "extend": { "colors": {
        "charmander": { "primary": "#ee7b30", ... }
      }}}},
      "cssVariables": { "--charmander-primary": "#ee7b30", ... }
    },
    ...
  ],
  "page": 1, "pageSize": 2, "total": 83, "totalPages": 42,
  "colorFormat": "hex", "shiny": false
}`,
  },
  {
    id: "single",
    label: "Get by ID/Name",
    method: "GET",
    path: "/api/v1/palettes/:id",
    params: "",
    desc: "Single Pok\u00e9mon by ID or name. Add ?format=rgb or ?shiny=true.",
    curl: `curl -H "Authorization: Bearer pkpal_YOUR_KEY" \\
  "https://www.pokemonpalette.com/api/v1/palettes/charizard?format=hsl"`,
    response: `{
  "id": 6,
  "name": "Charizard",
  "species": "Flame Pok\u00e9mon",
  "type": ["Fire", "Flying"],
  "generation": 1, "rarity": "Rare",
  "shiny": false, "colorFormat": "hsl",
  "colorPalette": {
    "primary": "hsl(27, 84%, 55%)",
    "secondary": "hsl(8, 56%, 53%)",
    "accent": "hsl(195, 91%, 18%)",
    "background": "hsl(0, 0%, 97%)",
    "text": "hsl(0, 0%, 17%)",
    "highlights": ["hsl(27, 84%, 55%)", "hsl(8, 56%, 53%)", ...]
  },
  "shinyColorPalette": {
    "primary": "hsl(265, 13%, 53%)", ...
  },
  "tailwindConfig": {
    "theme": { "extend": { "colors": {
      "charizard": {
        "primary": "hsl(27, 84%, 55%)", ...
      }
    }}}
  },
  "cssVariables": {
    "--charizard-primary": "hsl(27, 84%, 55%)", ...
  }
}`,
  },
  {
    id: "shiny",
    label: "Shiny Variant",
    method: "GET",
    path: "/api/v1/palettes/:id",
    params: "?shiny=true",
    desc: "Returns the shiny palette as the primary colorPalette.",
    curl: `curl -H "Authorization: Bearer pkpal_YOUR_KEY" \\
  "https://www.pokemonpalette.com/api/v1/palettes/charizard?shiny=true"`,
    response: `{
  "id": 6,
  "name": "Charizard",
  "type": ["Fire", "Flying"],
  "shiny": true, "colorFormat": "hex",
  "colorPalette": {
    "primary": "#837b94",
    "secondary": "#5a5a6a",
    "accent": "#831029",
    "highlights": ["#837b94", "#5a5a6a", "#831029"]
  },
  "shinyColorPalette": null,
  "tailwindConfig": {
    "theme": { "extend": { "colors": {
      "charizard-shiny": {
        "primary": "#837b94",
        "secondary": "#5a5a6a",
        "accent": "#831029", ...
      }
    }}}
  },
  "cssVariables": {
    "--charizard-shiny-primary": "#837b94", ...
  }
}`,
  },
  {
    id: "random",
    label: "Random",
    method: "GET",
    path: "/api/v1/palettes/random",
    params: "",
    desc: "Random palette. Supports format and shiny params.",
    curl: `curl -H "Authorization: Bearer pkpal_YOUR_KEY" \\
  "https://www.pokemonpalette.com/api/v1/palettes/random?format=rgb"`,
    response: `{
  "id": 94,
  "name": "Gengar",
  "type": ["Ghost", "Poison"],
  "shiny": false, "colorFormat": "rgb",
  "colorPalette": {
    "primary": "rgb(148, 115, 180)",
    "secondary": "rgb(90, 74, 156)",
    "accent": "rgb(180, 139, 189)", ...
  },
  "shinyColorPalette": { ... },
  "tailwindConfig": {
    "theme": { "extend": { "colors": {
      "gengar": {
        "primary": "rgb(148, 115, 180)", ...
      }
    }}}
  },
  "cssVariables": {
    "--gengar-primary": "rgb(148, 115, 180)", ...
  }
}`,
  },
];

function ApiExplorer() {
  const [activeEndpoint, setActiveEndpoint] = useState(API_ENDPOINTS[0]);
  const [activeTab, setActiveTab] = useState<"curl" | "response" | "js" | "tailwind">("curl");

  const jsExample = `const res = await fetch(
  "https://www.pokemonpalette.com${activeEndpoint.path}${activeEndpoint.params}",
  { headers: { Authorization: "Bearer pkpal_YOUR_KEY" } }
);
const data = await res.json();`;

  const twExample = `// Fetch palette and spread into your Tailwind config
const palette = await fetch(
  "https://www.pokemonpalette.com/api/v1/palettes/charizard",
  { headers: { Authorization: \`Bearer \${process.env.PKPAL_KEY}\` } }
).then(r => r.json());

// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: palette.tailwindConfig.theme.extend.colors,
    },
  },
};
// => bg-charizard-primary, text-charizard-accent, etc.`;

  const codeMap = {
    curl: activeEndpoint.curl,
    response: activeEndpoint.response,
    js: jsExample,
    tailwind: twExample,
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Top bar: auth hint */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40 text-xs text-muted-foreground">
        <Key className="w-3.5 h-3.5" />
        <span>All requests require</span>
        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">Authorization: Bearer pkpal_...</code>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Endpoint selector */}
        <div className="md:w-56 border-b md:border-b-0 md:border-r bg-muted/20 p-2 md:p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible">
          {API_ENDPOINTS.map((ep) => (
            <button
              key={ep.id}
              onClick={() => { setActiveEndpoint(ep); setActiveTab("curl"); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors whitespace-nowrap ${
                activeEndpoint.id === ep.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <code className="text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                {ep.method}
              </code>
              <span className="text-xs">{ep.label}</span>
            </button>
          ))}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {/* URL bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/10">
            <code className="text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
              {activeEndpoint.method}
            </code>
            <code className="text-sm font-mono truncate">{activeEndpoint.path}{activeEndpoint.params}</code>
          </div>

          {/* Description */}
          <div className="px-4 py-2.5 border-b">
            <p className="text-xs text-muted-foreground">{activeEndpoint.desc}</p>
          </div>

          {/* Code tabs */}
          <div className="flex items-center border-b px-1">
            {(["curl", "js", "tailwind", "response"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "curl" ? "cURL" : tab === "js" ? "JavaScript" : tab === "tailwind" ? "Tailwind" : "Response"}
              </button>
            ))}
          </div>

          {/* Code output */}
          <div className="relative">
            <CopyButton text={codeMap[activeTab]} />
            <pre className="bg-zinc-950 text-zinc-300 p-4 text-[13px] overflow-auto leading-relaxed max-h-[420px] min-h-[200px]">
              <code>{codeMap[activeTab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApiAccessContent({ hasPurchased }: ApiAccessContentProps) {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [activeShowcase, setActiveShowcase] = useState(0);
  const [activeTocId, setActiveTocId] = useState("features");

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveShowcase((i) => (i + 1) % SHOWCASE_POKEMON.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const item of TOC_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handlePurchase = async () => {
    if (!isSignedIn) {
      toast.error("Please sign in first to purchase API access.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start checkout",
      );
    } finally {
      setLoading(false);
    }
  };

  const activePokemon = SHOWCASE_POKEMON[activeShowcase];
  const activeColors = [
    activePokemon.palette.primary,
    activePokemon.palette.secondary,
    activePokemon.palette.accent,
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <FloatingToc activeId={activeTocId} />

        <div className="flex-1 overflow-auto scroll-smooth">
          {/* Hero */}
          <section className="relative overflow-hidden border-b">
            <div className="absolute inset-0 opacity-[0.07] transition-colors duration-1000" style={{
              background: `linear-gradient(135deg, ${activeColors[0]} 0%, ${activeColors[1]} 50%, ${activeColors[2]} 100%)`,
            }} />
            <div className="relative container mx-auto px-4 md:px-6 py-16 md:py-24 max-w-5xl">
              <div className="flex flex-col md:flex-row md:items-center gap-10">
                <div className="flex-1 space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-4 py-1.5 text-sm font-medium">
                    <Palette className="w-4 h-4 text-primary" />
                    Developer API
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight font-heading leading-[1.1]">
                    Color palettes for
                    <br />
                    <span
                      className="transition-colors duration-700"
                      style={{ color: activePokemon.palette.primary }}
                    >
                      every
                    </span>{" "}
                    Pok&eacute;mon
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-lg">
                    Curated color systems for 1,350+ Pok&eacute;mon delivered as JSON, Tailwind
                    configs, and CSS variables. One-time purchase, lifetime access.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {hasPurchased ? (
                      <Button size="lg" className="h-12 px-8 text-base font-semibold" asChild>
                        <Link href="/account?tab=api">
                          <Key className="w-5 h-5 mr-2" />
                          Manage Your API Keys
                        </Link>
                      </Button>
                    ) : (
                      <PurchaseButton loading={loading} onClick={handlePurchase} />
                    )}
                    <Button variant="outline" size="lg" className="h-12" asChild>
                      <a href="#docs">
                        View Docs
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Live rotating swatch card */}
                <div className="flex-shrink-0 w-full md:w-80">
                  <div className="rounded-2xl border bg-card overflow-hidden">
                    <div className="relative flex h-32 transition-colors duration-700">
                      {activeColors.map((c, i) => (
                        <div key={i} className="flex-1 transition-colors duration-700" style={{ backgroundColor: c }} />
                      ))}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Image
                          src={activePokemon.sprite}
                          alt={activePokemon.name}
                          width={80}
                          height={80}
                          className="opacity-15 brightness-0 dark:invert transition-all duration-500"
                          unoptimized
                        />
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-lg transition-all duration-300">
                          {activePokemon.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">API response</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["primary", "secondary", "accent"] as const).map((role) => (
                          <div key={role} className="space-y-1">
                            <div
                              className="h-8 rounded-md border border-border/30 transition-colors duration-700"
                              style={{ backgroundColor: activePokemon.palette[role] }}
                            />
                            <p className="text-[10px] text-muted-foreground text-center">{role}</p>
                            <p className="text-[10px] font-mono text-center">{activePokemon.palette[role]}</p>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] font-mono bg-muted rounded-md p-2 text-muted-foreground leading-relaxed">
                        <span className="text-foreground">&quot;tailwindConfig&quot;:</span>{" "}
                        {`{ "colors": { "${activePokemon.name.toLowerCase()}": { ... } } }`}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center gap-1.5 mt-4">
                    {SHOWCASE_POKEMON.map((p, i) => (
                      <button
                        key={p.name}
                        onClick={() => setActiveShowcase(i)}
                        className="w-2 h-2 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: i === activeShowcase ? p.palette.primary : undefined,
                          opacity: i === activeShowcase ? 1 : 0.3,
                        }}
                        aria-label={`Show ${p.name}`}
                      >
                        {i !== activeShowcase && (
                          <span className="block w-2 h-2 rounded-full bg-muted-foreground/40" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Scrolling swatch ribbon */}
          <section className="border-b bg-muted/30 py-4 overflow-hidden">
            <div className="flex animate-scroll-left gap-3" style={{ width: "max-content" }}>
              {[...SHOWCASE_POKEMON, ...SHOWCASE_POKEMON].map((p, i) => {
                const colors = [p.palette.primary, p.palette.secondary, p.palette.accent];
                return (
                  <div key={`${p.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background">
                    <Image
                      src={p.sprite}
                      alt=""
                      width={20}
                      height={20}
                      className="opacity-40 brightness-0 dark:invert"
                      unoptimized
                    />
                    <div className="flex rounded-full overflow-hidden w-14 h-3.5">
                      {colors.map((c, j) => (
                        <div key={j} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="text-xs font-medium whitespace-nowrap">{p.name}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Value props */}
          <section id="features" className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold font-heading">
                Built for developers who care about color
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                Skip the pixel-picking. Get production-ready color systems straight from
                the API.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: Palette, title: "1,350+ Palettes", desc: "Every Pok\u00e9mon from Gen I\u2013IX with primary, secondary, accent, background, and text colors." },
                { icon: Paintbrush, title: "Hex, RGB, or HSL", desc: "Request colors in any format via ?format=hex|rgb|hsl. Plus Tailwind configs and CSS variables in every response." },
                { icon: Zap, title: "Shiny Variants", desc: "Add ?shiny=true to get the shiny palette as the primary colors. Every Pok\u00e9mon, regular and shiny." },
                { icon: Globe, title: "Filter & Search", desc: "Query by type, generation, name, or ID. Paginated list endpoint with up to 100 results per page." },
              ].map((f) => (
                <Card key={f.title} className="border bg-muted/40 shadow-none">
                  <CardHeader className="pb-2">
                    <f.icon className="w-7 h-7 text-primary mb-1" />
                    <CardTitle className="text-sm">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs leading-relaxed">{f.desc}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Swatch gallery */}
          <section id="palettes" className="border-y bg-muted/20">
            <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
              <h2 className="text-2xl font-bold font-heading text-center mb-8">
                Sample palettes from the API
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SHOWCASE_POKEMON.map((p) => (
                  <SwatchCard key={p.name} name={p.name} sprite={p.sprite} palette={p.palette} />
                ))}
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1 space-y-4">
                <h2 className="text-2xl md:text-3xl font-bold font-heading">
                  One price. Forever.
                </h2>
                <p className="text-muted-foreground">
                  No subscriptions, no metered billing, no surprise invoices.
                  Pay once and use the API for as long as it exists. Comparable
                  palette APIs charge $10&ndash;30{" "}
                  <span className="italic">per month</span>.
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500" />
                  Instant key delivery via email
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500" />
                  Up to 5 API keys per account
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500" />
                  Revoke &amp; regenerate keys anytime
                </div>
              </div>

              <Card className="w-full md:w-96 border-2 border-primary/30 shadow-none">
                <CardHeader className="text-center pb-2">
                  <CardDescription className="uppercase tracking-wider text-xs font-semibold text-primary">
                    Lifetime Access
                  </CardDescription>
                  <div className="pt-2">
                    <span className="text-5xl font-bold">$29</span>
                    <span className="text-muted-foreground ml-2">one-time</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  <ul className="space-y-2.5">
                    {[
                      "All 1,350+ Pok\u00e9mon color palettes",
                      "Shiny palettes included",
                      "Tailwind config in every response",
                      "CSS custom properties included",
                      "Filter by type & generation",
                      "Look up by ID or name",
                      "Random palette endpoint",
                      "600 req/min, edge-cached",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  {hasPurchased ? (
                    <Button className="w-full h-11" asChild>
                      <Link href="/account?tab=api">
                        <Key className="w-4 h-4 mr-2" />
                        Manage Your API Keys
                      </Link>
                    </Button>
                  ) : (
                    <PurchaseButton loading={loading} onClick={handlePurchase} />
                  )}
                  <p className="text-[11px] text-center text-muted-foreground">
                    Secure checkout via Stripe. No account required until payment.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* API Explorer */}
          <section id="docs" className="border-t bg-muted/10">
            <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl space-y-8">
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold font-heading">
                  API Reference
                </h2>
                <p className="text-muted-foreground mt-2">
                  Three endpoints. One auth header. That&apos;s it.
                </p>
              </div>

              <ApiExplorer />
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
            <h2 className="text-2xl font-bold font-heading text-center mb-8">
              Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm font-medium text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Bottom CTA */}
          {!hasPurchased && (
            <section className="border-t">
              <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
                <div className="relative rounded-2xl border-2 border-primary/20 bg-card p-8 md:p-12 text-center overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 flex">
                    {SHOWCASE_POKEMON.flatMap((p) => [p.palette.primary, p.palette.secondary, p.palette.accent]).map((c, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  {/* Decorative silhouettes */}
                  <div className="absolute -left-4 bottom-2 opacity-[0.04] pointer-events-none">
                    <Image src={BW2_SPRITE(6)} alt="" width={140} height={140} className="brightness-0 dark:invert" unoptimized />
                  </div>
                  <div className="absolute -right-4 bottom-2 opacity-[0.04] pointer-events-none">
                    <Image src={BW2_SPRITE(25)} alt="" width={120} height={120} className="brightness-0 dark:invert" unoptimized />
                  </div>
                  <h2 className="relative text-2xl md:text-3xl font-bold font-heading mb-3">
                    Start building with Pok&eacute;mon colors
                  </h2>
                  <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                    One API call. Tailwind config, CSS variables, and hex values for
                    any Pok&eacute;mon. Lifetime access for $29.
                  </p>
                  <PurchaseButton loading={loading} onClick={handlePurchase} />
                </div>
              </div>
            </section>
          )}

          <Footer />
        </div>
      </div>
    </div>
  );
}
