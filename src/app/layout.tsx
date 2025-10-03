import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://your-actual-domain.com"), // [TEMPLATE] Replace with your actual domain
  title: "[TEMPLATE] Your App Name - Update Me",
  description:
    "[TEMPLATE] Update this description to describe your application. This appears in search engine results and social media previews.",
  keywords: [
    "[TEMPLATE]",
    "your",
    "app",
    "keywords",
    "here",
    "replace",
    "these",
    "with",
    "actual",
    "keywords",
  ],
  authors: [
    {
      name: "[TEMPLATE] Your Name",
      url: "https://update-this-url.com",
    },
  ],
  creator: "[TEMPLATE] Your Name",
  publisher: "[TEMPLATE] Your Company/Organization",

  // OpenGraph metadata for social media sharing
  openGraph: {
    title: "[TEMPLATE] Your App Name",
    description:
      "[TEMPLATE] Update this description for social media previews.",
    url: "https://your-actual-domain.com",
    siteName: "[TEMPLATE] Your App Name",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png", // Replace with your actual image
        width: 1200,
        height: 630,
        alt: "[TEMPLATE] Your App Name",
      },
    ],
  },

  // Twitter Card metadata
  twitter: {
    card: "summary_large_image",
    title: "[TEMPLATE] Your App Name",
    description: "[TEMPLATE] Update this description for Twitter previews.",
    images: ["/twitter-image.png"], // Replace with your actual image
    creator: "@yourtwitterhandle", // Replace with your Twitter handle
  },

  // Additional metadata
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Favicon and icons
  icons: {
    icon: "/favicon.ico", // Replace with your favicon
    shortcut: "/favicon-16x16.png", // Replace with your favicon
    apple: "/apple-touch-icon.png", // Replace with your apple touch icon
  },

  manifest: "/site.webmanifest", // Create and replace with your manifest file

  // Verification for search engines (optional)
  verification: {
    google: "[TEMPLATE] Add your Google Search Console verification code",
    yandex: "[TEMPLATE] Add your Yandex verification code if needed",
    yahoo: "[TEMPLATE] Add your Yahoo verification code if needed",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if Clerk keys are available
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Wrap children with ClerkProvider only if keys are available
  const content = publishableKey ? (
    <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
  ) : (
    children
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {content}
        </ThemeProvider>
      </body>
    </html>
  );
}
