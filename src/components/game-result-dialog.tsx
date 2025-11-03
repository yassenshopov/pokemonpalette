"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { Pokemon } from "@/types/pokemon";

interface GameResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "won" | "lost";
  targetPokemon: Pokemon | null;
  isShiny: boolean | null;
  mode: "daily" | "unlimited";
  user: any;
  onResetGame: () => void;
}

export function GameResultDialog({
  open,
  onOpenChange,
  status,
  targetPokemon,
  isShiny,
  mode,
  user,
  onResetGame,
}: GameResultDialogProps) {
  const isWon = status === "won";
  const title = isWon ? "🎉 You Won!" : "Game Over";
  const titleClassName = isWon
    ? "text-2xl font-bold"
    : "text-2xl font-bold text-red-600 dark:text-red-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {targetPokemon && (
            <DialogDescription className="text-base mt-2">
              The Pokemon was <strong>{targetPokemon.name}</strong>
              {isShiny === true ? " (Shiny)" : ""}!
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {mode === "daily" && !user && (
            <SignInButton mode="modal">
              <Button className="w-full cursor-pointer">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Save Progress
              </Button>
            </SignInButton>
          )}
          {mode === "unlimited" && (
            <Button onClick={onResetGame} className="w-full">
              {isWon ? "Play Again" : "Try Again"}
            </Button>
          )}
          {mode === "daily" && user && (
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

