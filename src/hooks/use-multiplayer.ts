"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type MultiplayerStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "joining"
  | "playing"
  | "finished";

export interface MultiplayerPlayer {
  userId: string;
  username: string | null;
  imageUrl: string | null;
  attempts: number;
  won: boolean;
  bestSimilarity: number;
  hintsUsed: number;
  finished: boolean;
  guesses: number[] | number;
}

export interface MultiplayerState {
  status: MultiplayerStatus;
  roomCode: string | null;
  roomId: string | null;
  isShiny: boolean;
  targetPokemonId: number | null;
  players: MultiplayerPlayer[];
  winnerUserId: string | null;
  error: string | null;
  loading: boolean;
}

const INITIAL_STATE: MultiplayerState = {
  status: "idle",
  roomCode: null,
  roomId: null,
  isShiny: false,
  targetPokemonId: null,
  players: [],
  winnerUserId: null,
  error: null,
  loading: false,
};

export function useMultiplayer(userId: string | null | undefined) {
  const [state, setState] = useState<MultiplayerState>(INITIAL_STATE);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const fetchRoomState = useCallback(
    async (roomCode: string) => {
      try {
        const res = await fetch(`/api/multiplayer/rooms/${roomCode}`);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  const subscribeToRoom = useCallback(
    (roomCode: string) => {
      cleanup();

      const channel = supabase.channel(`multiplayer:${roomCode}`, {
        config: { broadcast: { self: true } },
      });

      channel
        .on("broadcast", { event: "room_update" }, (payload) => {
          const data = payload.payload;
          setState((prev) => ({
            ...prev,
            status: data.status === "finished" ? "finished" : prev.status,
            players: data.players ?? prev.players,
            winnerUserId: data.winnerUserId ?? prev.winnerUserId,
            targetPokemonId:
              data.targetPokemonId ?? prev.targetPokemonId,
          }));
        })
        .on("broadcast", { event: "player_joined" }, () => {
          setState((prev) => ({
            ...prev,
            status: "playing",
          }));
          fetchRoomState(roomCode).then((data) => {
            if (data) {
              setState((prev) => ({
                ...prev,
                status:
                  data.status === "finished"
                    ? "finished"
                    : data.status === "playing"
                    ? "playing"
                    : prev.status,
                players: data.players ?? prev.players,
              }));
            }
          });
        })
        .on("broadcast", { event: "guess_made" }, (payload) => {
          const { userId: guessUserId, attempts, bestSimilarity, won, finished } =
            payload.payload;
          setState((prev) => ({
            ...prev,
            players: prev.players.map((p) =>
              p.userId === guessUserId
                ? { ...p, attempts, bestSimilarity, won, finished }
                : p
            ),
          }));
        })
        .on("broadcast", { event: "player_gave_up" }, (payload) => {
          const { userId: gaveUpUserId } = payload.payload;
          setState((prev) => ({
            ...prev,
            players: prev.players.map((p) =>
              p.userId === gaveUpUserId ? { ...p, finished: true } : p
            ),
          }));
          fetchRoomState(roomCode).then((data) => {
            if (data) {
              setState((prev) => ({
                ...prev,
                status: data.status === "finished" ? "finished" : prev.status,
                winnerUserId: data.winnerUserId ?? prev.winnerUserId,
                targetPokemonId:
                  data.targetPokemonId ?? prev.targetPokemonId,
                players: data.players ?? prev.players,
              }));
            }
          });
        })
        .on("broadcast", { event: "game_finished" }, (payload) => {
          const data = payload.payload;
          setState((prev) => ({
            ...prev,
            status: "finished",
            winnerUserId: data.winnerUserId,
            targetPokemonId: data.targetPokemonId,
            players: data.players ?? prev.players,
          }));
        })
        .subscribe();

      channelRef.current = channel;

      pollRef.current = setInterval(async () => {
        const data = await fetchRoomState(roomCode);
        if (data) {
          setState((prev) => {
            const newStatus =
              data.status === "finished"
                ? "finished"
                : data.status === "playing"
                ? "playing"
                : prev.status;
            return {
              ...prev,
              status: newStatus,
              players: data.players ?? prev.players,
              winnerUserId: data.winnerUserId ?? prev.winnerUserId,
              targetPokemonId:
                data.targetPokemonId ?? prev.targetPokemonId,
            };
          });
        }
      }, 5000);
    },
    [cleanup, fetchRoomState]
  );

  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      channelRef.current?.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    []
  );

  const createRoom = useCallback(async () => {
    if (!userId) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/multiplayer/rooms", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create room");
      }
      const data = await res.json();

      setState((prev) => ({
        ...prev,
        status: "waiting",
        roomCode: data.roomCode,
        roomId: data.roomId,
        loading: false,
        players: [
          {
            userId,
            username: null,
            imageUrl: null,
            attempts: 0,
            won: false,
            bestSimilarity: 0,
            hintsUsed: 0,
            finished: false,
            guesses: [],
          },
        ],
      }));

      subscribeToRoom(data.roomCode);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to create room",
      }));
    }
  }, [userId, subscribeToRoom]);

  const joinRoom = useCallback(
    async (roomCode: string) => {
      if (!userId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const code = roomCode.toUpperCase().trim();

      try {
        const res = await fetch(`/api/multiplayer/rooms/${code}/join`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to join room");
        }

        const roomData = await fetchRoomState(code);
        if (!roomData) throw new Error("Failed to load room data");

        setState((prev) => ({
          ...prev,
          status: "playing",
          roomCode: code,
          roomId: roomData.roomId,
          isShiny: roomData.isShiny,
          players: roomData.players,
          loading: false,
        }));

        subscribeToRoom(code);
        broadcast("player_joined", { userId });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to join room",
        }));
      }
    },
    [userId, subscribeToRoom, fetchRoomState, broadcast]
  );

  const submitGuess = useCallback(
    async (pokemonId: number, similarity: number) => {
      if (!state.roomCode || !userId) return null;

      try {
        const res = await fetch(
          `/api/multiplayer/rooms/${state.roomCode}/guess`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pokemonId, similarity }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to submit guess");
        }

        const result = await res.json();

        setState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.userId === userId
              ? {
                  ...p,
                  attempts: result.attempts,
                  won: result.correct,
                  bestSimilarity: result.bestSimilarity,
                  finished: result.finished,
                }
              : p
          ),
          targetPokemonId:
            result.targetPokemonId ?? prev.targetPokemonId,
        }));

        broadcast("guess_made", {
          userId,
          attempts: result.attempts,
          bestSimilarity: result.bestSimilarity,
          won: result.correct,
          finished: result.finished,
        });

        if (result.finished) {
          const roomData = await fetchRoomState(state.roomCode);
          if (roomData?.status === "finished") {
            setState((prev) => ({
              ...prev,
              status: "finished",
              winnerUserId: roomData.winnerUserId,
              targetPokemonId: roomData.targetPokemonId,
              players: roomData.players ?? prev.players,
            }));
            broadcast("game_finished", {
              winnerUserId: roomData.winnerUserId,
              targetPokemonId: roomData.targetPokemonId,
              players: roomData.players,
            });
          }
        }

        return result;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to submit guess",
        }));
        return null;
      }
    },
    [state.roomCode, userId, broadcast, fetchRoomState]
  );

  const giveUp = useCallback(async () => {
    if (!state.roomCode || !userId) return;

    try {
      const res = await fetch(
        `/api/multiplayer/rooms/${state.roomCode}/give-up`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to give up");
      }

      const result = await res.json();

      setState((prev) => ({
        ...prev,
        targetPokemonId: result.targetPokemonId,
        players: prev.players.map((p) =>
          p.userId === userId ? { ...p, finished: true } : p
        ),
      }));

      broadcast("player_gave_up", { userId });

      const roomData = await fetchRoomState(state.roomCode);
      if (roomData?.status === "finished") {
        setState((prev) => ({
          ...prev,
          status: "finished",
          winnerUserId: roomData.winnerUserId,
          targetPokemonId: roomData.targetPokemonId,
          players: roomData.players ?? prev.players,
        }));
        broadcast("game_finished", {
          winnerUserId: roomData.winnerUserId,
          targetPokemonId: roomData.targetPokemonId,
          players: roomData.players,
        });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to give up",
      }));
    }
  }, [state.roomCode, userId, broadcast, fetchRoomState]);

  const leaveRoom = useCallback(() => {
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  return {
    ...state,
    createRoom,
    joinRoom,
    submitGuess,
    giveUp,
    leaveRoom,
  };
}
