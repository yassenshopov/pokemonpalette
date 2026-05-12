"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Loader2,
  CheckCircle2,
  X,
  XCircle,
  ChevronDown,
  RefreshCw,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { AdminUserAvatar } from "@/components/admin/user-cell";
import { cn } from "@/lib/utils";
import type { EmailTemplate, EmailTemplateData } from "@/lib/email-service";

interface EmailUser {
  id: string;
  email: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  profile_image_url?: string | null;
}

interface EmailLog {
  id: string;
  recipientEmail: string;
  senderEmail: string;
  senderName: string | null;
  subject: string;
  templateType: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

const EMAIL_TEMPLATES: {
  value: EmailTemplate;
  label: string;
  description: string;
}[] = [
  {
    value: "daily-drop",
    label: "Daily Drop",
    description: "Announces that today's Pokémon Palette puzzle is live.",
  },
  {
    value: "daily-nudge",
    label: "Daily Nudge",
    description: "Reminder to play today's challenge before it expires.",
  },
];

function templateLabel(value: string): string {
  return (
    EMAIL_TEMPLATES.find((t) => t.value === value)?.label ??
    value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AdminEmailsTabProps {
  /**
   * Bumped by parent components (e.g. the page-level Refresh button)
   * to trigger a re-fetch of users, logs, and the preview iframe.
   */
  refreshSignal?: number;
  /**
   * Hide the in-tab Refresh button when the parent is rendering its own
   * (the admin page header places Refresh up at the breadcrumb row).
   */
  hideInternalRefresh?: boolean;
}

export function AdminEmailsTab({
  refreshSignal = 0,
  hideInternalRefresh = false,
}: AdminEmailsTabProps = {}) {
  const [users, setUsers] = useState<EmailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate>("daily-drop");
  const [emailInput, setEmailInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewFrom, setPreviewFrom] = useState<string>(
    "noreply@pokemonpalette.com",
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [sendResults, setSendResults] = useState<Array<{
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }> | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    // SSR fallback (component is "use client" but a static render path
    // may briefly evaluate this). Reading NEXT_PUBLIC_BASE_URL directly
    // is fine on the client — Next inlines it at build time — but on
    // the server the env validator (src/lib/env.ts) is authoritative.
    return (
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.pokemonpalette.com"
    );
  };

  const getTemplateData = useCallback((): EmailTemplateData[EmailTemplate] => {
    const baseUrl = getBaseUrl();
    switch (selectedTemplate) {
      case "daily-nudge":
        return {
          gameUrl: `${baseUrl}/game`,
        };
      case "daily-drop":
        return {
          gameUrl: `${baseUrl}/game`,
          baseUrl,
        };
      default:
        return {} as EmailTemplateData[EmailTemplate];
    }
  }, [selectedTemplate]);

  const generatePreview = useCallback(async () => {
    try {
      setPreviewLoading(true);
      const templateData = getTemplateData();

      const response = await fetch("/api/admin/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate,
          data: templateData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to preview email");
      }

      const { preview } = await response.json();
      setPreviewHtml(preview.html);
      setPreviewText(preview.text);
      setPreviewSubject(preview.subject);
      if (preview.fromEmail) setPreviewFrom(preview.fromEmail);
    } catch (error) {
      console.error("Error previewing email:", error);
      toast.error("Failed to preview email");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTemplate, getTemplateData]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/emails/users");

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const response = await fetch(
        `/api/admin/emails/logs?template=${selectedTemplate}&limit=25`,
      );
      if (!response.ok) throw new Error("Failed to load logs");
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      toast.error("Failed to load send log");
    } finally {
      setLogsLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (selectedTemplate && !loading) {
      generatePreview();
    }
  }, [selectedTemplate, loading, generatePreview]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchUsers(), fetchLogs(), generatePreview()]);
    toast.success("Refreshed");
  }, [fetchUsers, fetchLogs, generatePreview]);

  // Respond to a parent-driven refresh (e.g. page header Refresh button).
  // Skip the initial mount so we don't fire duplicate fetches on first render.
  useEffect(() => {
    if (refreshSignal === 0) return;
    void handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const handleSend = async () => {
    if (selectedEmails.length === 0) {
      toast.error("Please select at least one email address");
      return;
    }

    try {
      setSending(true);
      setSendResults(null);

      const uniqueSelectedEmails = Array.from(
        new Map(
          selectedEmails.map((email) => [email.toLowerCase(), email]),
        ).values(),
      );

      const templateData = getTemplateData();
      const uniqueSelectedEmailsLower = uniqueSelectedEmails.map((e) =>
        e.toLowerCase(),
      );
      const userIds = users
        .filter((user) =>
          uniqueSelectedEmailsLower.includes(user.email.toLowerCase()),
        )
        .map((user) => user.id);

      const customEmails = uniqueSelectedEmails.filter(
        (email) =>
          !users.some(
            (user) => user.email.toLowerCase() === email.toLowerCase(),
          ),
      );

      const response = await fetch("/api/admin/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate,
          data: templateData,
          userIds: userIds.length > 0 ? userIds : undefined,
          to: customEmails.length > 0 ? customEmails : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send emails");
      }

      const result = await response.json();
      setSendResults(result.results || []);

      if (result.sent > 0) {
        toast.success(`Successfully sent ${result.sent} email(s)`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to send ${result.failed} email(s)`);
      }

      if (result.sent > 0) {
        setSelectedEmails([]);
        setEmailInput("");
        fetchLogs();
      }
    } catch (error) {
      console.error("Error sending emails:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send emails",
      );
    } finally {
      setSending(false);
      setShowConfirmDialog(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const selectedEmailsLower = selectedEmails.map((e) => e.toLowerCase());
    if (!emailInput.trim()) {
      return users.filter(
        (user) => !selectedEmailsLower.includes(user.email.toLowerCase()),
      );
    }
    return users.filter(
      (user) =>
        !selectedEmailsLower.includes(user.email.toLowerCase()) &&
        (user.email.toLowerCase().includes(emailInput.toLowerCase()) ||
          user.name.toLowerCase().includes(emailInput.toLowerCase())),
    );
  }, [emailInput, users, selectedEmails]);

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
    setShowSuggestions(true);
  };

  const handleSelectUser = (user: EmailUser) => {
    const emailLower = user.email.toLowerCase();
    if (!selectedEmails.some((e) => e.toLowerCase() === emailLower)) {
      setSelectedEmails([...selectedEmails, user.email]);
    }
    setEmailInput("");
    setShowSuggestions(false);
  };

  const handleRemoveEmail = (email: string) => {
    setSelectedEmails(selectedEmails.filter((e) => e !== email));
  };

  const handleEmailInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter" && emailInput.trim()) {
      e.preventDefault();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedEmail = emailInput.trim();
      if (emailRegex.test(trimmedEmail)) {
        const emailLower = trimmedEmail.toLowerCase();
        if (!selectedEmails.some((e) => e.toLowerCase() === emailLower)) {
          setSelectedEmails([...selectedEmails, trimmedEmail]);
        }
        setEmailInput("");
        setShowSuggestions(false);
      } else {
        toast.error("Please enter a valid email address");
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleEmailInputBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const activeTemplate = EMAIL_TEMPLATES.find(
    (t) => t.value === selectedTemplate,
  );

  return (
    <div className="space-y-10">
      {!hideInternalRefresh && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || previewLoading || logsLoading}
          >
            <RefreshCw
              className={cn(
                "mr-2 size-4",
                (loading || previewLoading || logsLoading) && "animate-spin",
              )}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      )}

      {/* Compose — template, preview, recipients, and send all live together
          because they share the same workflow: pick a template → confirm what
          it looks like → pick who gets it → send. */}
      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Compose</h2>
            <p className="text-xs text-muted-foreground">
              Pick a template, review it, choose recipients, and send.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className="rounded-sm px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider"
            >
              Auth
            </Badge>
            <span>
              from:{" "}
              <span className="font-mono text-foreground">{previewFrom}</span>
            </span>
          </div>
        </div>

        {/* Template + Recipients on a single row so both inputs are
            actionable side-by-side; chips/help text stack below. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <Label
              htmlFor="email-template-select"
              className="text-sm font-medium"
            >
              Template
            </Label>
            <Select
              value={selectedTemplate}
              onValueChange={(value) =>
                setSelectedTemplate(value as EmailTemplate)
              }
            >
              <SelectTrigger
                id="email-template-select"
                className="w-full"
              >
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TEMPLATES.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTemplate?.description && (
              <p className="text-xs text-muted-foreground">
                {activeTemplate.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailInput">Recipients</Label>
            <div className="relative">
              <Input
                id="emailInput"
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. jane@example.com…"
                aria-describedby="email-input-help"
                value={emailInput}
                disabled={loading}
                onChange={(e) => handleEmailInputChange(e.target.value)}
                onKeyDown={handleEmailInputKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={handleEmailInputBlur}
              />

              {showSuggestions && filteredUsers.length > 0 && (
                <div
                  role="listbox"
                  className="absolute z-10 mt-1 max-h-[240px] w-full overflow-auto border bg-popover"
                >
                  {filteredUsers.slice(0, 50).map((user) => (
                    <div
                      key={user.id}
                      role="option"
                      aria-selected="false"
                      tabIndex={0}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectUser(user);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectUser(user);
                        }
                      }}
                    >
                      <AdminUserAvatar user={user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{user.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p
              id="email-input-help"
              className="text-xs text-muted-foreground"
            >
              Press Enter to add. Start typing a name or email to search
              registered users.
            </p>
          </div>
        </div>

        {selectedEmails.length > 0 && (
          <ul
            className="flex flex-wrap gap-2"
            aria-label="Selected recipients"
          >
            {selectedEmails.map((email) => {
              const user = users.find((u) => u.email === email);
              return (
                <li key={email}>
                  <Badge
                    variant="secondary"
                    className="gap-1.5 py-1 pl-1 pr-2"
                  >
                    {user ? (
                      <AdminUserAvatar user={user} size="xs" />
                    ) : null}
                    <span className="truncate">{user?.name || email}</span>
                    <button
                      type="button"
                      className="ml-0.5 inline-flex size-4 items-center justify-center rounded-sm hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove ${email}`}
                      onClick={() => handleRemoveEmail(email)}
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}

        <Collapsible
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          className="space-y-3"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="-mx-1 inline-flex items-center gap-2 rounded-sm px-1 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Toggle email preview"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  !previewOpen && "-rotate-90",
                )}
                aria-hidden="true"
              />
              Preview
              {previewSubject && (
                <span className="ml-1 truncate text-xs font-normal normal-case tracking-normal text-muted-foreground/80">
                  — {previewSubject}
                </span>
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-3">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="h-[640px] w-full border bg-white"
                title="Email HTML preview"
              />
            ) : (
              <div
                className="flex h-[480px] items-center justify-center border text-sm text-muted-foreground"
                aria-live="polite"
              >
                {loading
                  ? "Loading email management…"
                  : previewLoading
                    ? "Generating preview…"
                    : "No preview available."}
              </div>
            )}

            {previewText && (
              <details>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  Plain text version
                </summary>
                <ScrollArea className="mt-2 h-[150px] border p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {previewText}
                  </pre>
                </ScrollArea>
              </details>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={() => setShowConfirmDialog(true)}
          disabled={sending || selectedEmails.length === 0}
          className="w-full sm:w-auto"
        >
          {sending ? (
            <>
              <Loader2
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" aria-hidden="true" />
              Send Email ({selectedEmails.length})
            </>
          )}
        </Button>

        {sendResults && (
          <div role="status" aria-live="polite" className="space-y-2 pt-2">
            <Label>Send Results</Label>
            <ScrollArea className="h-[150px] border">
              <ul className="divide-y">
                {sendResults.map((result, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-sm">{result.email}</span>
                    {result.success ? (
                      <Badge variant="default">
                        <CheckCircle2
                          className="mr-1 size-3"
                          aria-hidden="true"
                        />
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 size-3" aria-hidden="true" />
                        {result.error || "Failed"}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
      </section>

      {/* Send Log */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Send Log</h2>
          {logs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Showing latest {logs.length}
            </span>
          )}
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Mail
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              No email logs found
            </p>
          </div>
        ) : (
          <ul className="divide-y border-y">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">
                      {log.recipientEmail}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] uppercase tracking-wider"
                    >
                      {templateLabel(log.templateType)}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {log.subject}
                  </p>
                  {log.errorMessage && (
                    <p className="truncate text-xs text-destructive">
                      {log.errorMessage}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {log.status === "sent" ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle2
                        className="mr-1 size-3"
                        aria-hidden="true"
                      />
                      Sent
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="mr-1 size-3" aria-hidden="true" />
                      Failed
                    </Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatLogTime(log.sentAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Send Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send this email to {selectedEmails.length} recipient(s)?
            </AlertDialogDescription>
            <div className="mt-2 max-h-[200px] overflow-auto">
              {selectedEmails.map((email) => (
                <div key={email} className="text-sm text-muted-foreground">
                  • {email}
                </div>
              ))}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
