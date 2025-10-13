import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { SetupChecklist } from "@/components/setup-checklist";
import Image from "next/image";
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
  Github,
  ExternalLink,
  Sparkles,
  Layers,
} from "lucide-react";

export default function Home() {
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
                <Image
                  src="/logo.png"
                  alt="Starter Yeast logo"
                  width={64}
                  height={16}
                  className="mr-4 dark:invert"
                  unoptimized
                />
                <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent font-heading">
                  Starter Yeast
                </h1>
              </div>
              <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
                The perfect fermentation starter for your Next.js applications.
                A modern boilerplate with all the ingredients you need to build
                amazing web apps.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <a
                  href="https://nextjs.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm px-4 py-2 rounded-lg bg-card border-2 border-gray-600 text-foreground font-semibold hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgb(75,85,99)] hover:shadow-[1px_1px_0px_0px_rgb(75,85,99)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-200"
                >
                  <Image
                    src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg"
                    alt="Next.js"
                    width={16}
                    height={16}
                    className="h-4 w-4 mr-2"
                    unoptimized
                  />
                  Next.js 15
                </a>
                <a
                  href="https://tailwindcss.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm px-4 py-2 rounded-lg bg-card border-2 border-gray-600 text-foreground font-semibold hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgb(75,85,99)] hover:shadow-[1px_1px_0px_0px_rgb(75,85,99)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-200"
                >
                  <Image
                    src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg"
                    alt="Tailwind CSS"
                    width={16}
                    height={16}
                    className="h-4 w-4 mr-2"
                    unoptimized
                  />
                  Tailwind CSS
                </a>
                <a
                  href="https://ui.shadcn.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm px-4 py-2 rounded-lg bg-card border-2 border-gray-600 text-foreground font-semibold hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgb(75,85,99)] hover:shadow-[1px_1px_0px_0px_rgb(75,85,99)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-200"
                >
                  <Image
                    src="https://avatars.githubusercontent.com/u/139895814?v=4"
                    alt="shadcn/ui"
                    width={16}
                    height={16}
                    className="h-4 w-4 mr-2 rounded-sm"
                    unoptimized
                  />
                  shadcn/ui
                </a>
                <a
                  href="https://clerk.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm px-4 py-2 rounded-lg bg-card border-2 border-gray-600 text-foreground font-semibold hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgb(75,85,99)] hover:shadow-[1px_1px_0px_0px_rgb(75,85,99)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-200"
                >
                  <Image
                    src="https://ph-files.imgix.net/297bc3d4-bd2e-4eaa-8fb6-a289cf61ea91.png?auto=format"
                    alt="Clerk Auth"
                    width={16}
                    height={16}
                    className="h-4 w-4 mr-2"
                    unoptimized
                  />
                  Clerk Auth
                </a>
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

          {/* Getting Started */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4 font-heading">
              Ready to Start Baking?
            </h2>
            <p className="text-muted-foreground mb-6">
              Clone this repository and begin building your next amazing
              application.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Documentation
              </Button>
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center text-sm text-muted-foreground pt-8 border-t">
            <p>Starter Yeast v0.1.0 • Built with ❤️ for developers</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
