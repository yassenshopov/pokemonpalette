"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Sparkles,
  Trash2,
  User as UserIcon,
  XCircle,
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
import { formatAbsolute, formatAbsoluteDate } from "@/lib/admin/format";

interface Attempt {
  id: string;
  user_id: string;
  date: string;
  target_pokemon_id: number;
  is_shiny: boolean;
  guesses: number[] | null;
  attempts: number;
  won: boolean;
  pokemon_guessed: number | null;
  hints_used: number;
  created_at: string;
}

interface AttemptDetailData {
  attempt: Attempt;
  user: {
    id: string;
    email: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    profile_image_url: string | null;
  } | null;
}

function officialArtworkUrl(pokemonId: number, shiny = false) {
  const suffix = shiny ? "/shiny" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${suffix}/${pokemonId}.png`;
}

function ownerLabel(u: AttemptDetailData["user"]): string {
  if (!u) return "Unknown player";
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

export function AttemptDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = React.useState<AttemptDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/admin/game-data/${id}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        return (await res.json()) as AttemptDetailData;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to load attempt.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [id]);

  const onDelete = async () => {
    try {
      const res = await fetch(`/api/admin/game-data/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success("Attempt deleted");
      router.push("/admin/game");
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
          {error ?? "Attempt not found."}
        </CardContent>
      </Card>
    );
  }

  const { attempt, user } = data;
  const guesses = Array.isArray(attempt.guesses) ? attempt.guesses : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative size-28 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image
                src={officialArtworkUrl(
                  attempt.target_pokemon_id,
                  attempt.is_shiny,
                )}
                alt=""
                fill
                sizes="112px"
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">
                  Puzzle for {formatAbsoluteDate(attempt.date)}
                </h2>
                {attempt.won ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Win
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="size-3.5" aria-hidden="true" />
                    Loss
                  </Badge>
                )}
                {attempt.is_shiny ? (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Shiny target
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Target{" "}
                <span className="font-mono tabular-nums" translate="no">
                  #{attempt.target_pokemon_id.toString().padStart(4, "0")}
                </span>{" "}
                · {attempt.attempts} attempt{attempt.attempts === 1 ? "" : "s"}
                {attempt.hints_used > 0 ? ` · ${attempt.hints_used} hints` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Played {formatAbsolute(attempt.created_at)} ·{" "}
                <RelativeTime value={attempt.created_at} />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(attempt.id, "Attempt ID")}
              >
                <Copy className="mr-1.5 size-4" aria-hidden="true" />
                Copy ID
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
                    <AlertDialogTitle>Delete this attempt?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the attempt. This cannot be
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
                      Delete attempt
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Guess sequence</CardTitle>
          <CardDescription>
            {guesses.length} guess{guesses.length === 1 ? "" : "es"}
            {attempt.pokemon_guessed
              ? ` · Final guess #${attempt.pokemon_guessed}`
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {guesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No guess data recorded.
            </p>
          ) : (
            <ol
              className="flex flex-wrap items-center gap-2"
              aria-label="Guess order"
            >
              {guesses.map((g, i) => {
                const isTarget = g === attempt.target_pokemon_id;
                return (
                  <li
                    key={`${g}-${i}`}
                    className="flex items-center gap-1.5"
                  >
                    <Link
                      href={`/admin/game?view=attempts&target_pokemon_id=${g}`}
                      className="group flex items-center gap-2 rounded-md border p-1.5 pr-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                        <Image
                          src={officialArtworkUrl(g)}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          #{g.toString().padStart(4, "0")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Guess {i + 1}
                          {isTarget ? " · match" : ""}
                        </span>
                      </div>
                    </Link>
                    {i < guesses.length - 1 ? (
                      <ArrowRight
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Player</CardTitle>
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
              {attempt.user_id}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/users/${attempt.user_id}`}>
              <UserIcon className="mr-1.5 size-4" aria-hidden="true" />
              View player
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
