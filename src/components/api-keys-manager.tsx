"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
import {
  Key,
  Plus,
  Loader2,
  Copy,
  Check,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  name: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysManager() {
  const searchParams = useSearchParams();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlainKey, setNewPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [noSubscription, setNoSubscription] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/account/api-keys");
      if (res.status === 403) {
        setNoSubscription(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch keys");
      const data = await res.json();
      setKeys(data.keys);
      setNoSubscription(false);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  useEffect(() => {
    const purchase = searchParams.get("purchase");
    if (purchase === "success") {
      toast.success("Purchase successful! Your first API key has been created.");
      fetchKeys();
    } else if (purchase === "cancel") {
      toast.info("Purchase cancelled.");
    }
  }, [searchParams, fetchKeys]);

  const createKey = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/account/api-keys", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create key");
      }
      const { key } = await res.json();
      setNewPlainKey(key.plainKey);
      await fetchKeys();
      toast.success("New API key created");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create key",
      );
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      const res = await fetch(`/api/account/api-keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke key");
      }
      toast.success("API key revoked");
      await fetchKeys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke key",
      );
    }
  };

  const copyKey = () => {
    if (!newPlainKey) return;
    navigator.clipboard.writeText(newPlainKey);
    setCopied(true);
    toast.success("Key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-center gap-2">
              <Key className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">API Keys</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Manage your PokémonPalette API keys
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 md:px-6 py-8 max-w-3xl space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : noSubscription ? (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>No API Access</CardTitle>
                  <CardDescription>
                    You haven&apos;t purchased API access yet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Button asChild>
                    <Link href="/api-access">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Get API Access
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* New key banner */}
                {newPlainKey && (
                  <Card className="border-green-500/50 bg-green-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-green-600 dark:text-green-400">
                        New API Key Created
                      </CardTitle>
                      <CardDescription>
                        Copy this key now. It will not be shown again.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted rounded px-3 py-2 text-sm font-mono break-all select-all">
                          {newPlainKey}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={copyKey}
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Create button */}
                <div className="flex justify-end">
                  <Button onClick={createKey} disabled={creating}>
                    {creating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create New Key
                  </Button>
                </div>

                {/* Active keys */}
                {activeKeys.length === 0 && !newPlainKey ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No active API keys. Create one to get started.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activeKeys.map((k) => (
                      <Card key={k.id}>
                        <CardContent className="flex items-center justify-between py-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono">
                                pkpal_{k.keyPrefix}...
                              </code>
                              {k.name && (
                                <span className="text-xs text-muted-foreground">
                                  ({k.name})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Created{" "}
                              {new Date(k.createdAt).toLocaleDateString()}
                              {k.lastUsedAt && (
                                <>
                                  {" · "}
                                  Last used{" "}
                                  {new Date(k.lastUsedAt).toLocaleDateString()}
                                </>
                              )}
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Revoke API Key
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently revoke{" "}
                                  <code className="text-sm">
                                    pkpal_{k.keyPrefix}...
                                  </code>
                                  . Any requests using this key will be
                                  rejected. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => revokeKey(k.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Revoke Key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Revoked keys */}
                {revokedKeys.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Revoked Keys
                    </h3>
                    {revokedKeys.map((k) => (
                      <Card key={k.id} className="opacity-50">
                        <CardContent className="flex items-center justify-between py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono line-through">
                                pkpal_{k.keyPrefix}...
                              </code>
                              {k.name && (
                                <span className="text-xs text-muted-foreground">
                                  ({k.name})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Revoked{" "}
                              {new Date(k.revokedAt!).toLocaleDateString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}
