"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      {/* 404 GIF */}
      <div className="mb-8">
        <Image
          src="/404.gif"
          alt="404 Not Found"
          width={400}
          height={300}
          className="rounded-lg"
          unoptimized
        />
      </div>

      {/* Message */}
      <div className="text-center max-w-md mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Uh oh. That page doesn't exist.
        </h1>
        <p className="text-muted-foreground">
          Head to our{" "}
          <Link
            href="/"
            className="underline hover:text-foreground transition-colors"
          >
            homepage
          </Link>{" "}
          that does exist.
        </p>
      </div>

      {/* Action Button */}
      <Button asChild size="lg">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
