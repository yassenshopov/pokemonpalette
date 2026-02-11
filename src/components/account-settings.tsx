"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Palette, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";
import { ColorblindSettings } from "@/components/colorblind-settings";
import { PALETTE_SIZE_OPTIONS, type PaletteSize } from "@/constants/pokemon";

export function AccountSettings() {
  const { user, isLoaded: userLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const [receivesDailyEmails, setReceivesDailyEmails] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paletteSize, setPaletteSize] = useState<PaletteSize>(3);
  const [paletteSizeLoading, setPaletteSizeLoading] = useState(true);
  const [paletteSizeSaving, setPaletteSizeSaving] = useState(false);

  useEffect(() => {
    if (userLoaded && user?.id) {
      fetchEmailPreference();
      fetchPalettePreference();
    }
  }, [userLoaded, user?.id]);

  const fetchEmailPreference = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/account/email-preference");
      
      if (!response.ok) {
        throw new Error("Failed to fetch email preference");
      }

      const data = await response.json();
      setReceivesDailyEmails(data.receivesDailyEmails ?? true);
    } catch (error) {
      console.error("Error fetching email preference:", error);
      toast.error("Failed to load email preference");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPreferenceChange = async (checked: boolean) => {
    try {
      setSaving(true);
      const response = await fetch("/api/account/email-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivesDailyEmails: checked }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update email preference");
      }

      setReceivesDailyEmails(checked);
      toast.success(
        checked
          ? "Daily email notifications enabled"
          : "Daily email notifications disabled"
      );
    } catch (error) {
      console.error("Error updating email preference:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update email preference"
      );
      // Revert the switch on error
      setReceivesDailyEmails(!checked);
    } finally {
      setSaving(false);
    }
  };

  const fetchPalettePreference = async () => {
    try {
      setPaletteSizeLoading(true);
      const response = await fetch("/api/account/palette-preference");
      if (!response.ok) throw new Error("Failed to fetch palette preference");
      const data = await response.json();
      const n = data.paletteSize;
      if (typeof n === "number" && PALETTE_SIZE_OPTIONS.includes(n as PaletteSize)) {
        setPaletteSize(n as PaletteSize);
      }
    } catch (error) {
      console.error("Error fetching palette preference:", error);
      toast.error("Failed to load palette preference");
    } finally {
      setPaletteSizeLoading(false);
    }
  };

  const handlePaletteSizeChange = async (value: string) => {
    const n = parseInt(value, 10) as PaletteSize;
    if (!PALETTE_SIZE_OPTIONS.includes(n)) return;
    try {
      setPaletteSizeSaving(true);
      const response = await fetch("/api/account/palette-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paletteSize: n }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update palette preference");
      }
      setPaletteSize(n);
      window.dispatchEvent(new CustomEvent("palette-preference-changed", { detail: n }));
      toast.success(`Palette set to ${n} colours`);
    } catch (error) {
      console.error("Error updating palette preference:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update palette preference"
      );
    } finally {
      setPaletteSizeSaving(false);
    }
  };

  if (!userLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please sign in to view your account settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor="#3b82f6" />
      <CollapsibleSidebar primaryColor="#3b82f6" />
      <div className="flex-1 flex flex-col h-full overflow-auto">
        <div className="container mx-auto p-6 space-y-6 mt-12 max-w-4xl">
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account preferences and settings
            </p>
          </div>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Preferences
              </CardTitle>
              <CardDescription>
                Control how you receive emails from Pokémon Palette
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading preferences...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="daily-emails" className="text-base">
                      Daily Game Reminders
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive daily email reminders to play the Pokémon Palette challenge
                    </p>
                  </div>
                  <Switch
                    id="daily-emails"
                    checked={receivesDailyEmails}
                    onCheckedChange={handleEmailPreferenceChange}
                    disabled={saving}
                    className="cursor-pointer"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Palette size */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Palette
              </CardTitle>
              <CardDescription>
                How many colours to extract and show per Pokémon (e.g. for palettes or scientific illustrations)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paletteSizeLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="palette-size" className="text-base">
                      Number of colours
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Show 3, 4, 5, or 6 colours in the palette
                    </p>
                  </div>
                  <Select
                    value={String(paletteSize)}
                    onValueChange={handlePaletteSizeChange}
                    disabled={paletteSizeSaving}
                  >
                    <SelectTrigger id="palette-size" className="w-24">
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

          <Separator />

          {/* Color Vision Settings */}
          <ColorblindSettings />

          <Separator />

          {/* Clerk Account Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Management
              </CardTitle>
              <CardDescription>
                Manage your account details, password, and security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Account Details</Label>
                    <p className="text-sm text-muted-foreground">
                      Update your profile, email, password, and security settings
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => openUserProfile()}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Open Account Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    </div>
  );
}

