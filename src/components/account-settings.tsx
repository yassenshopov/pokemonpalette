"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, UserProfile as ClerkUserProfile } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  Mail,
  Palette,
  User,
  Key,
  Eye,
  Plus,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Shield,
  ShieldCheck,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";
import { ColorblindSettings } from "@/components/colorblind-settings";
import { PALETTE_SIZE_OPTIONS, type PaletteSize } from "@/constants/pokemon";

type AccountTab = "profile" | "api" | "security";

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  name: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const NAV_ITEMS: { id: AccountTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Preferences", icon: User },
  { id: "api", label: "API Keys", icon: Key },
  { id: "security", label: "Security & Login", icon: Shield },
];

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.round(diff / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return relativeFmt.format(-days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return relativeFmt.format(-months, "month");
  return relativeFmt.format(-Math.round(days / 365), "year");
}

export function AccountSettings({
  initialTab,
  showApiKeys = false,
  isAdmin = false,
}: {
  initialTab?: AccountTab;
  showApiKeys?: boolean;
  isAdmin?: boolean;
}) {
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") as AccountTab | null;
  const validTabs: AccountTab[] = showApiKeys
    ? ["profile", "api", "security"]
    : ["profile", "security"];
  const visibleNav = NAV_ITEMS.filter((item) => item.id !== "api" || showApiKeys);
  const [activeTab, setActiveTab] = useState<AccountTab>(
    initialTab ?? (tabParam && validTabs.includes(tabParam) ? tabParam : "profile"),
  );

  const switchTab = (tab: AccountTab) => {
    setActiveTab(tab);
    const url = tab === "profile" ? "/account" : `/account?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  // -- Email prefs --
  const [receivesDailyEmails, setReceivesDailyEmails] = useState(true);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);

  // -- Palette prefs --
  const [paletteSize, setPaletteSize] = useState<PaletteSize>(3);
  const [paletteSizeLoading, setPaletteSizeLoading] = useState(true);
  const [paletteSizeSaving, setPaletteSizeSaving] = useState(false);

  // -- API keys --
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlainKey, setNewPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [noSubscription, setNoSubscription] = useState(false);

  // Fetch helpers
  const fetchEmailPref = useCallback(async () => {
    try {
      setEmailLoading(true);
      const res = await fetch("/api/account/email-preference");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReceivesDailyEmails(data.receivesDailyEmails ?? true);
    } catch {
      toast.error("Failed to load email preference");
    } finally {
      setEmailLoading(false);
    }
  }, []);

  const fetchPalettePref = useCallback(async () => {
    try {
      setPaletteSizeLoading(true);
      const res = await fetch("/api/account/palette-preference");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const n = data.paletteSize;
      if (typeof n === "number" && PALETTE_SIZE_OPTIONS.includes(n as PaletteSize)) {
        setPaletteSize(n as PaletteSize);
      }
    } catch {
      toast.error("Failed to load palette preference");
    } finally {
      setPaletteSizeLoading(false);
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/account/api-keys");
      if (res.status === 403) {
        setNoSubscription(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeys(data.keys);
      setNoSubscription(false);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoaded || !user?.id) return;
    fetchEmailPref();
    fetchPalettePref();
    fetchKeys();
  }, [userLoaded, user?.id, fetchEmailPref, fetchPalettePref, fetchKeys]);

  // Handle purchase redirect
  useEffect(() => {
    const purchase = searchParams.get("purchase");
    if (purchase === "success") {
      toast.success("Purchase successful! Your first API key has been created.");
      setActiveTab("api");
      fetchKeys();
    } else if (purchase === "cancel") {
      toast.info("Purchase cancelled.");
    }
  }, [searchParams, fetchKeys]);

  // Actions
  const handleEmailChange = async (checked: boolean) => {
    try {
      setEmailSaving(true);
      const res = await fetch("/api/account/email-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivesDailyEmails: checked }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }
      setReceivesDailyEmails(checked);
      toast.success(checked ? "Daily reminders enabled" : "Daily reminders disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
      setReceivesDailyEmails(!checked);
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePaletteSizeChange = async (value: string) => {
    const n = parseInt(value, 10) as PaletteSize;
    if (!PALETTE_SIZE_OPTIONS.includes(n)) return;
    try {
      setPaletteSizeSaving(true);
      const res = await fetch("/api/account/palette-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paletteSize: n }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }
      setPaletteSize(n);
      window.dispatchEvent(new CustomEvent("palette-preference-changed", { detail: n }));
      toast.success(`Palette set to ${n} colours`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setPaletteSizeSaving(false);
    }
  };

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
      setKeys((prev) => [
        { id: key.id, keyPrefix: key.keyPrefix, name: key.name, lastUsedAt: null, revokedAt: null, createdAt: key.createdAt },
        ...prev,
      ]);
      toast.success("New API key created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    const prev = keys;
    setKeys((k) =>
      k.map((key) =>
        key.id === id ? { ...key, revokedAt: new Date().toISOString() } : key,
      ),
    );
    toast.success("API key revoked");
    try {
      const res = await fetch(`/api/account/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke key");
      }
    } catch (err) {
      setKeys(prev);
      toast.error(err instanceof Error ? err.message : "Failed to revoke key");
    }
  };

  const copyKey = () => {
    if (!newPlainKey) return;
    navigator.clipboard.writeText(newPlainKey);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (!userLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading account…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view your account.</p>
      </div>
    );
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor="#3b82f6" />
      <CollapsibleSidebar primaryColor="#3b82f6" />

      <div className="flex-1 flex flex-col h-full overflow-auto">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container mx-auto px-4 md:px-6 py-5 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight font-heading">Account</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <div className="flex flex-col md:flex-row gap-8 py-8">
              {/* Side nav */}
              <nav className="md:w-48 flex-shrink-0" aria-label="Account sections">
                <div className="flex md:flex-col gap-1">
                  {visibleNav.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => switchTab(item.id)}
                      aria-current={activeTab === item.id ? "page" : undefined}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left w-full ${
                        activeTab === item.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                  {isAdmin && (
                    <>
                      <div className="hidden md:block my-1 border-t" />
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">Admin</span>
                      </Link>
                    </>
                  )}
                </div>
              </nav>

              {/* Main content */}
              <main className="flex-1 min-w-0 space-y-6 pb-12">
                {activeTab === "profile" && (
                  <>
                    {/* Email */}
                    <section>
                      <SectionHeader icon={Mail} title="Email Preferences" />
                      <Card className="shadow-none">
                        <CardContent className="py-5">
                          {emailLoading ? (
                            <LoadingRow />
                          ) : (
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <Label htmlFor="daily-emails" className="text-sm font-medium">
                                  Daily Game Reminders
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Get a daily email reminder to play the Pok&eacute;mon Palette challenge
                                </p>
                              </div>
                              <Switch
                                id="daily-emails"
                                checked={receivesDailyEmails}
                                onCheckedChange={handleEmailChange}
                                disabled={emailSaving}
                                aria-label="Toggle daily email reminders"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </section>

                    {/* Palette size */}
                    <section>
                      <SectionHeader icon={Palette} title="Palette" />
                      <Card className="shadow-none">
                        <CardContent className="py-5">
                          {paletteSizeLoading ? (
                            <LoadingRow />
                          ) : (
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <Label htmlFor="palette-size" className="text-sm font-medium">
                                  Colours Per Palette
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Show 3, 4, 5, or 6 colours for each Pok&eacute;mon
                                </p>
                              </div>
                              <Select
                                value={String(paletteSize)}
                                onValueChange={handlePaletteSizeChange}
                                disabled={paletteSizeSaving}
                              >
                                <SelectTrigger id="palette-size" className="w-20" aria-label="Number of colours">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PALETTE_SIZE_OPTIONS.map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </section>

                    {/* Color vision */}
                    <section>
                      <SectionHeader icon={Eye} title="Accessibility" />
                      <ColorblindSettings />
                    </section>

                  </>
                )}

                {activeTab === "api" && showApiKeys && (
                  <>
                    {keysLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Loading API keys…" />
                      </div>
                    ) : noSubscription ? (
                      <section>
                        <SectionHeader icon={Key} title="API Access" />
                        <Card className="shadow-none">
                          <CardContent className="py-10 text-center space-y-4">
                            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <Code className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <div>
                              <p className="font-medium">No API Access Yet</p>
                              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                                Purchase lifetime API access to get Pok&eacute;mon color palettes
                                as JSON, Tailwind configs, and CSS variables.
                              </p>
                            </div>
                            <Button asChild>
                              <Link href="/api-access">
                                Get API Access
                                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      </section>
                    ) : (
                      <>
                        {/* New key modal */}
                        <AlertDialog open={!!newPlainKey} onOpenChange={(open) => { if (!open) setNewPlainKey(null); }}>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Your New API Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Copy this key now. It won&apos;t be shown again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="flex items-center gap-2 my-2">
                              <code className="flex-1 bg-muted rounded-md px-3 py-2.5 text-sm font-mono break-all select-all min-w-0">
                                {newPlainKey}
                              </code>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={copyKey}
                                aria-label={copied ? "Copied" : "Copy API key"}
                              >
                                {copied ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogAction onClick={() => setNewPlainKey(null)}>
                                Done
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Header + create */}
                        <section>
                          <div className="flex items-center justify-between mb-4">
                            <SectionHeader icon={Key} title="Active Keys" />
                            <Button
                              size="sm"
                              onClick={createKey}
                              disabled={creating || activeKeys.length >= 5}
                            >
                              {creating ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              Create Key
                            </Button>
                          </div>

                          {activeKeys.length === 0 && !newPlainKey ? (
                            <Card className="shadow-none">
                              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                No active API keys. Create one to get started.
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="rounded-lg border divide-y">
                              {activeKeys.map((k) => (
                                <div
                                  key={k.id}
                                  className="flex items-center justify-between px-4 py-3 gap-4"
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className="text-sm font-mono">
                                        pkpal_{k.keyPrefix}&hellip;
                                      </code>
                                      {k.name && (
                                        <Badge variant="secondary" className="text-[10px]">
                                          {k.name}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Created {dateFmt.format(new Date(k.createdAt))}
                                      {k.lastUsedAt && (
                                        <> &middot; Used {relativeTime(k.lastUsedAt)}</>
                                      )}
                                    </p>
                                  </div>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" aria-label={`Revoke key pkpal_${k.keyPrefix}`}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently revoke{" "}
                                          <code className="text-sm font-mono">pkpal_{k.keyPrefix}&hellip;</code>.
                                          Any requests using this key will be rejected. This cannot be undone.
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
                                </div>
                              ))}
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground mt-2">
                            {activeKeys.length}/5 keys used. Keys are hashed &mdash; we never store or log the plain-text key.
                          </p>
                        </section>

                        {/* Revoked */}
                        {revokedKeys.length > 0 && (
                          <section>
                            <SectionHeader icon={Trash2} title="Revoked Keys" muted />
                            <div className="rounded-lg border divide-y opacity-60">
                              {revokedKeys.map((k) => (
                                <div key={k.id} className="flex items-center px-4 py-3 gap-4">
                                  <div className="min-w-0 space-y-0.5">
                                    <code className="text-sm font-mono line-through">
                                      pkpal_{k.keyPrefix}&hellip;
                                    </code>
                                    <p className="text-xs text-muted-foreground">
                                      Revoked {dateFmt.format(new Date(k.revokedAt!))}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* Usage hint */}
                        <section>
                          <Card className="shadow-none bg-muted/40 border-dashed">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Code className="w-4 h-4" aria-hidden="true" />
                                Quick Start
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <pre className="text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
{`curl -H "Authorization: Bearer pkpal_YOUR_KEY" \\
  https://www.pokemonpalette.com/api/v1/palettes/pikachu`}
                              </pre>
                              <div className="mt-3">
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                                  <Link href="/api-access#docs">
                                    View Full API Reference
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </section>
                      </>
                    )}
                  </>
                )}

                {activeTab === "security" && (
                  <section className="[&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-cardBox]:shadow-none [&_.cl-card]:w-full [&_.cl-card]:shadow-none [&_.cl-navbar]:hidden [&_.cl-pageScrollBox]:p-0 [&_.cl-page]:p-0">
                    <ClerkUserProfile
                      routing="hash"
                      appearance={{
                        elements: {
                          rootBox: { width: "100%" },
                          cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none" },
                          card: { width: "100%", maxWidth: "100%", boxShadow: "none", margin: 0 },
                          navbar: { display: "none" },
                          pageScrollBox: { padding: 0 },
                          page: { padding: 0 },
                          scrollBox: { padding: 0 },
                        },
                      }}
                    />
                  </section>
                )}
              </main>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  muted,
}: {
  icon: typeof User;
  title: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${muted ? "text-muted-foreground" : "text-primary"}`} aria-hidden="true" />
      <h2 className={`text-sm font-semibold ${muted ? "text-muted-foreground" : ""}`}>{title}</h2>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 py-1">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">Loading&hellip;</span>
    </div>
  );
}
