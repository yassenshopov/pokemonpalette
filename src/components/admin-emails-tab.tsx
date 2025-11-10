"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { Mail, Send, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { EmailTemplate, EmailTemplateData } from "@/lib/email-service";

interface EmailUser {
  id: string;
  email: string;
  name: string;
}

const EMAIL_TEMPLATES: { value: EmailTemplate; label: string }[] = [
  { value: "daily-nudge", label: "Daily Nudge" },
];

export function AdminEmailsTab() {
  const [users, setUsers] = useState<EmailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>("daily-nudge");
  const [emailInput, setEmailInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendResults, setSendResults] = useState<Array<{
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }> | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Get base URL - use window location on client, env on server
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_BASE_URL || "https://www.pokemonpalette.com";
  };

  const getTemplateData = useCallback((): EmailTemplateData[EmailTemplate] => {
    const baseUrl = getBaseUrl();
    switch (selectedTemplate) {
      case "daily-nudge":
        return {
          gameUrl: `${baseUrl}/game`,
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
    } catch (error) {
      console.error("Error previewing email:", error);
      toast.error("Failed to preview email");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTemplate, getTemplateData]);

  const fetchUsers = async () => {
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
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-generate preview when template changes
  useEffect(() => {
    if (selectedTemplate && !loading) {
      generatePreview();
    }
  }, [selectedTemplate, loading, generatePreview]);

  const handleSend = async () => {
    if (selectedEmails.length === 0) {
      toast.error("Please select at least one email address");
      return;
    }

    try {
      setSending(true);
      setSendResults(null);

      // Deduplicate selected emails (case-insensitive)
      const uniqueSelectedEmails = Array.from(
        new Map(
          selectedEmails.map((email) => [email.toLowerCase(), email])
        ).values()
      );

      const templateData = getTemplateData();
      const uniqueSelectedEmailsLower = uniqueSelectedEmails.map((e) => e.toLowerCase());
      const userIds = users
        .filter((user) => uniqueSelectedEmailsLower.includes(user.email.toLowerCase()))
        .map((user) => user.id);

      const customEmails = uniqueSelectedEmails.filter(
        (email) => !users.some((user) => user.email.toLowerCase() === email.toLowerCase())
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

      // Clear selections after successful send
      if (result.sent > 0) {
        setSelectedEmails([]);
        setEmailInput("");
      }
    } catch (error) {
      console.error("Error sending emails:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send emails");
    } finally {
      setSending(false);
      setShowConfirmDialog(false);
    }
  };


  // Filter users based on email input
  const filteredUsers = useMemo(() => {
    const selectedEmailsLower = selectedEmails.map((e) => e.toLowerCase());
    if (!emailInput.trim()) {
      return users.filter((user) => !selectedEmailsLower.includes(user.email.toLowerCase()));
    }
    return users.filter(
      (user) =>
        !selectedEmailsLower.includes(user.email.toLowerCase()) &&
        (user.email.toLowerCase().includes(emailInput.toLowerCase()) ||
          user.name.toLowerCase().includes(emailInput.toLowerCase()))
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

  const handleEmailInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && emailInput.trim()) {
      e.preventDefault();
      // Check if it's a valid email format
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
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading email management...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Management
          </CardTitle>
          <CardDescription>
            Preview and send emails to users using templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Email Template</Label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATES.map((template) => (
                <Badge
                  key={template.value}
                  variant={selectedTemplate === template.value ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2 text-sm"
                  onClick={() => setSelectedTemplate(template.value)}
                >
                  {template.label}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Recipient Selection */}
          <div className="space-y-2">
            <Label htmlFor="emailInput">Recipients</Label>
            <div className="relative">
              <Input
                id="emailInput"
                placeholder="Type email address or search users..."
                value={emailInput}
                onChange={(e) => handleEmailInputChange(e.target.value)}
                onKeyDown={handleEmailInputKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={handleEmailInputBlur}
              />
              
              {/* User Suggestions */}
              {showSuggestions && filteredUsers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-auto">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectUser(user);
                      }}
                    >
                      <div className="font-medium">{user.name}</div>
                      <div className="text-muted-foreground text-xs">{user.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Emails */}
            {selectedEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedEmails.map((email) => {
                  const user = users.find((u) => u.email === email);
                  return (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="px-3 py-1"
                    >
                      {user?.name || email}
                      <button
                        className="ml-2 hover:text-destructive"
                        onClick={() => handleRemoveEmail(email)}
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Send Button */}
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={sending || selectedEmails.length === 0}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email ({selectedEmails.length})
              </>
            )}
          </Button>

          {/* Send Results */}
          {sendResults && (
            <div className="space-y-2 p-4 border rounded-lg">
              <Label>Send Results</Label>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {sendResults.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="text-sm">{result.email}</span>
                      {result.success ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          {result.error || "Failed"}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <Separator />

          {/* Email Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Email Preview</Label>
              {previewLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {previewSubject && (
              <div className="p-4 border rounded-lg">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium">{previewSubject}</p>
              </div>
            )}

            {previewHtml ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    HTML Preview
                  </Label>
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[400px] border-0"
                      title="Email HTML Preview"
                    />
                  </div>
                </div>

                {previewText && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Plain Text Version
                    </Label>
                    <ScrollArea className="h-[150px] border rounded-lg p-4">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {previewText}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground border rounded-lg">
                {previewLoading ? "Generating preview..." : "No preview available"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
