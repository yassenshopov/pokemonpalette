import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { SetupChecklist } from "@/components/setup-checklist";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Zap,
  Palette,
  Shield,
  Code,
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
          <div className="text-center mb-12 pt-16">
            <div className="flex items-center justify-center mb-6">
              <FlaskConical className="h-16 w-16 text-primary mr-4" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Starter Yeast
              </h1>
            </div>
            <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
              The perfect fermentation starter for your Next.js applications. A
              modern boilerplate with all the ingredients you need to build
              amazing web apps.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Code className="h-3 w-3 mr-1" />
                Next.js 15
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Zap className="h-3 w-3 mr-1" />
                Tailwind CSS
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Palette className="h-3 w-3 mr-1" />
                shadcn/ui
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Shield className="h-3 w-3 mr-1" />
                Clerk Auth
              </Badge>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card className="transition-all">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <CardTitle>Rapid Development</CardTitle>
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
                  <CardTitle>Modern Stack</CardTitle>
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
                  <CardTitle>Component Library</CardTitle>
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
                  <CardTitle>Authentication Ready</CardTitle>
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
                  <CardTitle>Dark Mode</CardTitle>
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
                  <CardTitle>Mobile First</CardTitle>
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
            <h2 className="text-3xl font-bold mb-4">Ready to Start Baking?</h2>
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
