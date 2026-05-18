"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

/**
 * Custom PWA install prompt.
 *
 * Chrome / Edge / Brave fire a `beforeinstallprompt` event when the app
 * is install-eligible. The browser's default mini-infobar at the bottom
 * of the address bar is easy to miss and disappears after one dismissal;
 * intercepting the event and showing our own banner lets us:
 *   - keep prompting on subsequent visits (until the user dismisses ours
 *     too, in which case we remember it for 30 days)
 *   - track install funnel events
 *   - present copy that matches the brand voice
 *
 * iOS Safari doesn't support `beforeinstallprompt` — the prompt path
 * there is "Share → Add to Home Screen", which requires a separate UI.
 * That's out of scope for this MVP; we'll add it as a follow-up when we
 * see iOS-share-tap heatmap data justify it.
 */

const DISMISS_KEY = "pwa-install-dismissed-at";
const SHOW_AGAIN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The `beforeinstallprompt` event isn't standard yet — it's a Chromium
 * extension. We minimally type just the pieces we need.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < SHOW_AGAIN_AFTER_MS;
  } catch {
    // localStorage can throw in private mode / quota-exceeded; treat as
    // "not dismissed" and let the user dismiss again if they want.
    return false;
  }
}

function isAlreadyStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS legacy standalone flag — not used for prompting, but handy as a
  // belt-and-suspenders check so we never show the banner inside an
  // already-installed PWA.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isAlreadyStandalone()) return;
    if (wasRecentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      // Suppress the default mini-infobar so our banner is the only UI
      // the user sees. The captured event is what we replay on click.
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setPromptEvent(evt);
      track("pwa_install_prompt_shown", {
        // GA4 auto-categorizes referrer / device; this just labels which
        // surface (the install prompt) showed.
      });
    };

    const onInstalled = () => {
      track("pwa_installed");
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const handleInstall = async () => {
    track("pwa_install_clicked");
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      track("pwa_install_choice", { outcome: choice.outcome });
      // Either way the captured event is single-use — null it so React
      // unmounts the banner. `appinstalled` will also fire on accept.
      setPromptEvent(null);
      if (choice.outcome === "dismissed") {
        // Treat dismissal-via-native-dialog the same as our X button.
        rememberDismiss();
      }
    } catch (err) {
      track("pwa_install_error", {
        reason: err instanceof Error ? err.message : String(err),
      });
      setPromptEvent(null);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    track("pwa_install_dismissed");
    rememberDismiss();
    setPromptEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Install PokémonPalette as an app"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background/95 backdrop-blur-md shadow-lg p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-primary/10 p-2">
          <Download className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm font-heading">
            Install PokémonPalette
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Get one-tap access to the daily game and your Pokédex. No app
            store, no install size.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleInstall}
              disabled={installing}
              className="h-8 px-3 text-xs cursor-pointer"
            >
              {installing ? "Installing…" : "Install"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 px-3 text-xs cursor-pointer"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-md p-1 -m-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function rememberDismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Best-effort — if we can't persist, the banner will reappear on the
    // next page load. Annoying but not broken.
  }
}
