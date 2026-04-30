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

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-heading flex items-center justify-center gap-2">
            <Users className="w-6 h-6" />
            Multiplayer
          </CardTitle>
          <CardDescription>
            Challenge a friend to guess the same Pokemon from its color palette.
            Race to see who can identify it first!
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
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Users className="w-5 h-5 mr-2" />
              )}
              Create Room
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

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="Enter room code"
                className="text-center text-lg font-mono tracking-widest uppercase h-12"
                maxLength={6}
                disabled={loading}
              />
              <Button
                onClick={() => joinCode.length === 6 && onJoinRoom(joinCode)}
                disabled={loading || joinCode.length !== 6}
                size="lg"
                variant="outline"
                className="cursor-pointer h-12 px-4"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Enter a 6-character room code to join a friend&apos;s game
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950/30 rounded-md p-2">
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
          <CardTitle className="text-xl font-heading">
            Waiting for opponent...
          </CardTitle>
          <CardDescription>
            Share this code with a friend to start the battle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="text-4xl font-mono font-bold tracking-[0.5em] bg-muted rounded-lg px-6 py-4 select-all">
              {roomCode}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyCode}
              className="cursor-pointer h-12 w-12"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Waiting for a player to join...</span>
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
