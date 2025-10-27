"use client";

import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { SetupChecklist } from "@/components/setup-checklist";
import { AnimatedTechStack } from "@/components/animated-tech-stack";
import { Footer } from "@/components/footer";
import { PokemonTestComponent } from "@/components/pokemon-test-component";
import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Zap,
  Palette,
  Shield,
  Sparkles,
  Layers,
  Database,
  Code,
  Copy,
  Check,
} from "lucide-react";

export default function Home() {
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>(
    {}
  );

  const copyToClipboard = async (text: string, promptId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [promptId]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [promptId]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const prompts = [
    {
      id: "brand",
      title: "Brand & Identity",
      text: `# Customize the branding and visual identity
Replace "PokémonPalette" with my brand name "[YOUR_BRAND]" and update the color scheme to match my brand colors: [PRIMARY_COLOR], [SECONDARY_COLOR]. Update the logo, favicon, and any brand references throughout the app.`,
    },
    {
      id: "homepage",
      title: "Custom Landing Page",
      text: `# Replace the homepage with my custom landing page
Create a new homepage for my [APP_TYPE] application. Include sections for [HERO_SECTION], [FEATURES_SECTION], [ABOUT_SECTION], and [CTA_SECTION]. Use modern design principles with proper spacing, typography, and responsive layout. Replace the current boilerplate content with my specific messaging and value propositions.`,
    },
  ];

  return (
    <div className="flex h-screen">
      <CollapsibleSidebar />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          {/* Setup Checklist */}
          <SetupChecklist />

          {/* Hero Section */}
          <div className="text-center mb-12 pt-16 relative">
            <div className="absolute inset-0 -top-8 -bottom-8 bg-[radial-gradient(circle_at_1px_1px,rgb(156,163,175)_1px,transparent_0)] bg-[length:20px_20px] opacity-20"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-center mb-6">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent font-heading">
                  PokémonPalette
                </h1>
              </div>
              <p className="text-base sm:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
                The perfect fermentation starter for your Next.js applications.
                A modern boilerplate with all the ingredients you need to build
                amazing web apps.
              </p>
              <div className="mb-8">
                <AnimatedTechStack />
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">
                    Rapid Development
                  </CardTitle>
                </div>
                <CardDescription>
                  Pre-configured with all the essential tools and components you
                  need to start building immediately.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">Modern Stack</CardTitle>
                </div>
                <CardDescription>
                  Built with the latest versions of Next.js, Tailwind CSS, and
                  shadcn/ui for optimal performance.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">
                    Component Library
                  </CardTitle>
                </div>
                <CardDescription>
                  Includes all shadcn/ui components pre-installed and ready to
                  use in your projects.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">
                    Authentication Ready
                  </CardTitle>
                </div>
                <CardDescription>
                  Clerk integration for secure user authentication and
                  management out of the box.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">
                    Database & Backend
                  </CardTitle>
                </div>
                <CardDescription>
                  Supabase integration for PostgreSQL database, real-time
                  subscriptions, and serverless functions.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Code className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">
                    Type-Safe Database
                  </CardTitle>
                </div>
                <CardDescription>
                  Prisma ORM with full TypeScript support, schema management,
                  and automatic type generation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">Dark Mode</CardTitle>
                </div>
                <CardDescription>
                  Built-in dark mode support with smooth transitions and system
                  preference detection.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">Mobile First</CardTitle>
                </div>
                <CardDescription>
                  Responsive design with mobile-optimized sidebar and
                  touch-friendly interactions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Separator className="my-8" />

          {/* Pokemon Test Component */}
          <div className="mb-8">
            <PokemonTestComponent />
          </div>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}
