"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RelativeTime } from "@/components/admin/relative-time";
import { formatAbsolute } from "@/lib/admin/format";

interface Palette {
  id: string;
  user_id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_form: string | null;
  is_shiny: boolean;
  colors: string[];
  image_url: string | null;
  palette_name: string | null;
  created_at: string;
  updated_at: string;
}

interface PaletteDetailData {
  palette: Palette;
  user: {
    id: string;
    email: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    profile_image_url: string | null;
  } | null;
  related: Array<Palette & { user_id: string }>;
}

function ownerLabel(u: PaletteDetailData["user"]): string {
  if (!u) return "Unknown owner";
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return name || u.username || u.email || u.id;
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn’t copy ${label}`);
  }
}

function toCssVariables(colors: string[]) {
  return colors
    .map((c, i) => `  --palette-color-${i + 1}: ${c};`)
    .join("\n");
}

function toCssBlock(colors: string[]) {
  return `:root {\n${toCssVariables(colors)}\n}`;
}

export function PaletteDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = React.useState<PaletteDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/admin/saved-palettes/${id}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        return (await res.json()) as PaletteDetailData;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to load palette.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [id]);

  const onDelete = async () => {
    try {
      const res = await fetch(`/api/admin/saved-palettes/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success("Palette deleted");
      router.push("/admin/palettes");
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card role="alert">
        <CardContent className="py-4 text-sm text-destructive">
          {error ?? "Palette not found."}
        </CardContent>
      </Card>
    );
  }

  const { palette, user, related } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted">
              {palette.image_url ? (
                <Image
                  src={palette.image_url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-contain"
                  unoptimized
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold capitalize">
                  {palette.pokemon_name}
                </h2>
                {palette.is_shiny ? (
                  <Badge variant="default" className="gap-1">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Shiny
                  </Badge>
                ) : null}
                <Badge variant="secondary">
                  #{palette.pokemon_id.toString().padStart(4, "0")}
                </Badge>
              </div>
              {palette.palette_name ? (
                <p className="text-sm text-muted-foreground">
                  {palette.palette_name}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Saved {formatAbsolute(palette.created_at)} ·{" "}
                <RelativeTime value={palette.created_at} />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(palette.colors.join(", "), "Colors")}
              >
                <Copy className="mr-1.5 size-4" aria-hidden="true" />
                Copy colors
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  copy(JSON.stringify(palette, null, 2), "JSON")
                }
              >
                <Copy className="mr-1.5 size-4" aria-hidden="true" />
                Copy JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(toCssBlock(palette.colors), "CSS")}
              >
                <Copy className="mr-1.5 size-4" aria-hidden="true" />
                Copy CSS
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`/${palette.pokemon_name.toLowerCase()}`}
                  target="_blank"
                  rel="noopener"
                >
                  <ExternalLink className="mr-1.5 size-4" aria-hidden="true" />
                  Open public page
                </a>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this palette?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the palette. This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void onDelete();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete palette
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border">
            <div
              className="flex h-20 w-full"
              aria-label={`${palette.colors.length} colors`}
              role="img"
            >
              {palette.colors.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  onClick={() => copy(c, c)}
                  className="group relative flex-1 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  style={{ backgroundColor: c }}
                  title={`${c} — click to copy`}
                  aria-label={`Copy color ${c}`}
                >
                  <span className="pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span
                      className="rounded bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-foreground shadow-sm"
                      translate="no"
                    >
                      {c}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Owner</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{ownerLabel(user)}</p>
            {user?.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : null}
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              translate="no"
            >
              {palette.user_id}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/users/${palette.user_id}`}>
              <UserIcon className="mr-1.5 size-4" aria-hidden="true" />
              View user
            </Link>
          </Button>
        </CardContent>
      </Card>

      {related.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Other palettes for this Pokémon</CardTitle>
            <CardDescription>
              {related.length} recent palette{related.length === 1 ? "" : "s"}{" "}
              from other users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              role="list"
            >
              {related.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/palettes/${p.id}`}
                    className="block overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex h-12 w-full">
                      {p.colors.map((c, i) => (
                        <span
                          key={`${c}-${i}`}
                          className="flex-1"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs">
                        <RelativeTime value={p.created_at} />
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
