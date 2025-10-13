"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
}

export function SetupChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: "clerk-keys",
      title: "Configure Clerk API Keys",
      description: "Set up authentication environment variables",
      isCompleted: false,
      isRequired: true,
    },
    {
      id: "seo-config",
      title: "Update SEO & Metadata",
      description: "Replace template SEO attributes with your app details",
      isCompleted: false,
      isRequired: true,
    },
  ]);

  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissed state
  useEffect(() => {
    const dismissed = localStorage.getItem("setup-checklist-dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, []);

  // Check if Clerk keys and SEO are configured
  useEffect(() => {
    const checkClerkConfig = () => {
      // Check if Clerk is actually working by looking for Clerk elements or users
      let clerkCompleted = false;

      if (typeof window !== "undefined") {
        // Check if ClerkProvider is wrapping the app by looking for Clerk-specific elements
        const clerkElements = document.querySelectorAll("[data-clerk]");
        const hasClerkElements = clerkElements.length > 0;

        // Also check if user profile is showing (indicates Clerk is working)
        const userProfile =
          document.querySelector("[data-clerk-user]") ||
          document.querySelector(".clerk-user-button") ||
          document.querySelector('[class*="clerk"]');

        // Check for environment variable (only available client-side if NEXT_PUBLIC_)
        const hasPublicKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

        // More comprehensive Clerk detection
        const hasClerkLibrary = !!(window as unknown as { Clerk?: unknown })
          .Clerk;
        const clerkScript = document.querySelector('script[src*="clerk"]');

        // If Clerk library is loaded OR we have elements OR public key OR user profile
        clerkCompleted =
          hasClerkLibrary ||
          clerkElements.length > 0 ||
          !!clerkScript ||
          !!userProfile;

        console.log("Clerk Check:", {
          hasClerkLibrary,
          clerkScript: !!clerkScript,
          hasClerkElements,
          hasPublicKey,
          userProfile: !!userProfile,
          clerkElements: clerkElements.length,
          clerkCompleted,
        });
      }

      // Check SEO completion only if in browser
      let seoCompleted = true;
      if (typeof window !== "undefined") {
        const templateValues = [
          "[TEMPLATE] Your App Name - Update Me",
          "[TEMPLATE] Your App Name",
          "[TEMPLATE] Your Name",
          "[TEMPLATE] Your Company/Organization",
          "[TEMPLATE] Update this description",
          "https://update-this-url.com",
          "https://your-actual-domain.com",
          "metadataBase: new URL('https://your-actual-domain.com')", // Template metadataBase
        ];

        const pageTitle = document.title;
        const metaDescription =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || "";

        const hasTemplateValues = templateValues.some(
          (templateValue) =>
            pageTitle.includes(templateValue) ||
            metaDescription.includes(templateValue)
        );

        seoCompleted = !hasTemplateValues;

        // Debug logging
        console.log("Setup Checklist Debug:", {
          clerkCompleted,
          seoCompleted,
          pageTitle,
          metaDescription,
          hasTemplateValues,
        });
      }

      // Update items based on current state
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === "clerk-keys") {
            return { ...item, isCompleted: clerkCompleted };
          }
          if (item.id === "seo-config") {
            return { ...item, isCompleted: seoCompleted };
          }
          return item;
        })
      );

      // Show checklist if any required items are incomplete
      const shouldShow = !clerkCompleted || !seoCompleted;
      console.log("Should show checklist:", shouldShow, {
        clerkCompleted,
        seoCompleted,
      });
      setIsVisible(shouldShow);
    };

    // Check immediately
    checkClerkConfig();

    // Set up interval to check periodically (every 5 seconds - less aggressive)
    const intervalId = setInterval(checkClerkConfig, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, []); // Run once on mount

  const copyEnvTemplate = () => {
    const envTemplate = `# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here

#define_optional_clerk_urls_for_customization_if_needed
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(envTemplate);
      // Show a temporary success message
      alert("Environment template copied to clipboard!");
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = envTemplate;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Environment template copied to clipboard!");
    }
  };

  const handleDontShowAgain = () => {
    localStorage.setItem("setup-checklist-dismissed", "true");
    setIsDismissed(true);
  };

  const allCompleted = items.every(
    (item) => !item.isRequired || item.isCompleted
  );

  if (!isVisible || allCompleted || isDismissed) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Setup Checklist</h3>

        <div className="space-y-4">
          {items.map((item) => {
            return (
              <div key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>

                  {!item.isCompleted && (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetails(!showDetails)}
                        className="h-auto p-0 text-blue-600 hover:text-blue-700"
                      >
                        {showDetails ? "Hide details" : "Show instructions"} →
                      </Button>

                      {showDetails && (
                        <div className="mt-3 space-y-3">
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                            {item.id === "clerk-keys" && (
                              <ol className="text-sm space-y-1 list-decimal list-inside">
                                <li>
                                  Create a{" "}
                                  <Link
                                    href="https://clerk.com/"
                                    target="_blank"
                                    className="text-blue-600 hover:underline"
                                  >
                                    Clerk account
                                  </Link>
                                </li>
                                <li>
                                  Create a new application in your Clerk
                                  dashboard
                                </li>
                                <li>Copy your publishable and secret keys</li>
                                <li>
                                  Create a{" "}
                                  <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                                    .env.local
                                  </code>{" "}
                                  file in your project root
                                </li>
                                <li>Add the environment variables below</li>
                                <li>Restart your development server</li>
                              </ol>
                            )}

                            {item.id === "seo-config" && (
                              <div>
                                <p className="text-sm mb-3 font-medium">
                                  Update SEO in{" "}
                                  <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                                    src/app/layout.tsx
                                  </code>
                                  :
                                </p>
                                <ol className="text-sm space-y-2 list-decimal list-inside">
                                  <li>
                                    Replace{" "}
                                    <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">
                                      &ldquo;[TEMPLATE]&rdquo;
                                    </code>{" "}
                                    values with your actual:
                                    <ul className="ml-4 mt-1 text-xs space-y-1 list-disc">
                                      <li>App name and title</li>
                                      <li>Description</li>
                                      <li>Keywords</li>
                                      <li>Author name</li>
                                    </ul>
                                  </li>
                                  <li>
                                    Add your favicon to{" "}
                                    <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">
                                      public/
                                    </code>{" "}
                                    folder
                                  </li>
                                  <li>
                                    Update OpenGraph and Twitter card images
                                  </li>
                                  <li>
                                    Test your changes in browser developer tools
                                  </li>
                                </ol>
                              </div>
                            )}
                          </div>

                          {item.id === "clerk-keys" && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={copyEnvTemplate}
                                className="gap-2"
                              >
                                <Copy className="h-3 w-3" />
                                Copy Template
                              </Button>
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  href="https://clerk.com/docs/references/nextjs/installation"
                                  target="_blank"
                                >
                                  Clerk Docs
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDontShowAgain}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Don't show again
          </Button>
        </div>
      </div>
    </div>
  );
}
