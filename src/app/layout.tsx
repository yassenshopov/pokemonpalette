import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ColorblindProvider } from "@/components/colorblind-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";
import { StructuredData } from "@/components/structured-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pokemonpalette.com"),
  title:
    "PokémonPalette - Extract Color Palettes from Pokémon Sprites | Color Generator Tool",
  description:
    "Generate beautiful color palettes from your favorite Pokémon sprites. Extract dominant colors, create custom palettes, and discover the perfect color schemes for your design projects. Browse all 1000+ Pokémon with shiny variants.",
  keywords: [
    "pokemon",
    "color palette",
    "color extraction",
    "design tools",
    "pokemon colors",
    "sprite colors",
    "color generator",
    "palette generator",
    "pokemon sprites",
    "shiny pokemon",
    "color picker",
    "hex colors",
    "rgb colors",
    "hsl colors",
    "web design",
    "graphic design",
    "pokemon art",
    "color schemes",
    "pokemon palette",
    "digital art tools",
  ],
  authors: [
    {
      name: "Yassen Shopov",
      url: "https://github.com/yassenshopov",
    },
  ],
  creator: "Yassen Shopov",
  publisher: "PokémonPalette",

  // OpenGraph metadata for social media sharing
  openGraph: {
    title: "PokémonPalette - Extract Color Palettes from Pokémon Sprites",
    description:
      "Generate beautiful color palettes from your favorite Pokémon sprites. Extract dominant colors and create custom palettes for your design projects.",
    url: "https://www.pokemonpalette.com",
    siteName: "PokémonPalette",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png", // Replace with your actual image
        width: 1200,
        height: 630,
        alt: "PokémonPalette - Color Palette Generator for Pokémon Sprites",
      },
    ],
  },

  // Twitter Card metadata
  twitter: {
    card: "summary_large_image",
    title: "PokémonPalette - Extract Color Palettes from Pokémon Sprites",
    description:
      "Generate beautiful color palettes from your favorite Pokémon sprites. Extract dominant colors and create custom palettes for design projects.",
    images: ["/twitter-image.png"], // Replace with your actual image
    creator: "@yassenshopov", // Replace with your Twitter handle
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

  // Canonical URL
  alternates: {
    canonical: "https://www.pokemonpalette.com",
  },

  // Verification for search engines (optional)
  // verification: {
  //   google: "Add your Google Search Console verification code",
  //   yandex: "Add your Yandex verification code if needed",
  //   yahoo: "Add your Yahoo verification code if needed",
  // },
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

  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${outfit.variable} antialiased`}
      >
        <StructuredData />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ColorblindProvider>
            {content}
            <Analytics />
            <Toaster position="top-center" />
          </ColorblindProvider>
        </ThemeProvider>
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${ga4Id}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
