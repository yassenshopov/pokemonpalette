"use client";

import { useState } from "react";
import { Copy, Check, Users, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MultiplayerLobbyProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  loading: boolean;
  error: string | null;
}

export function MultiplayerLobby({
  onCreateRoom,
  onJoinRoom,
  loading,
  error,
}: MultiplayerLobbyProps) {
  const [joinCode, setJoinCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length === 6) onJoinRoom(joinCode);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-heading flex items-center justify-center gap-2 text-wrap-balance">
            <Users className="w-6 h-6" aria-hidden="true" />
            Multiplayer
          </CardTitle>
          <CardDescription className="text-pretty">
            Challenge a friend to guess the same Pokémon from its color
            palette. Race to see who can identify it first!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Button
              onClick={onCreateRoom}
              disabled={loading}
              className="w-full cursor-pointer h-12 text-base font-heading"
              size="lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Users className="w-5 h-5 mr-2" aria-hidden="true" />
              )}
              {loading ? "Creating\u2026" : "Create Room"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Create a room and share the code with a friend
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <label htmlFor="room-code-input" className="sr-only">
                Room code
              </label>
              <Input
                id="room-code-input"
                name="room-code"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="ABCDEF"
                className="text-center text-lg font-mono tracking-widest uppercase h-12"
                maxLength={6}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
                aria-label="Room code"
              />
              <Button
                type="submit"
                disabled={loading || joinCode.length !== 6}
                size="lg"
                variant="outline"
                className="cursor-pointer h-12 px-4"
                aria-label="Join room"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Enter a 6-character room code to join a friend&apos;s game
            </p>
          </form>

          {error && (
            <p
              className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950/30 rounded-md p-2"
              role="alert"
            >
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface WaitingRoomProps {
  roomCode: string;
  onCancel: () => void;
}

export function WaitingRoom({ roomCode, onCancel }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-heading text-wrap-balance">
            Waiting for opponent{"\u2026"}
          </CardTitle>
          <CardDescription>
            Share this code with a friend to start the battle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div
              className="text-4xl font-mono font-bold tracking-[0.5em] bg-muted rounded-lg px-6 py-4 select-all tabular-nums"
              aria-label={`Room code: ${roomCode.split("").join(" ")}`}
            >
              {roomCode}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyCode}
              className="cursor-pointer h-12 w-12"
              aria-label={copied ? "Copied" : "Copy room code"}
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500" aria-hidden="true" />
              ) : (
                <Copy className="w-5 h-5" aria-hidden="true" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-muted-foreground" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">Waiting for a player to join{"\u2026"}</span>
          </div>

          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full cursor-pointer"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
