import { io } from 'socket.io-client';
import { useEffect, useRef } from 'react';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected to server: ${socketInstance.id}`);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });
  }
  return socketInstance;
}

/**
 * Custom hook to subscribe to real-time events for a specific tournament.
 * @param {string} tournamentId - Tournament ID to subscribe to
 * @param {Object} handlers - Map of event names to handler functions { onMatchUpdate, onStandingsUpdate, onStageAdvanced }
 */
export function useTournamentSocket(tournamentId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!tournamentId) return;

    const socket = getSocket();

    // Join room
    socket.emit('join:tournament', tournamentId);

    const handleMatchUpdate = (match) => {
      console.log('[Socket] match:update received:', match._id);
      if (handlersRef.current.onMatchUpdate) {
        handlersRef.current.onMatchUpdate(match);
      }
    };

    const handleStandingsUpdate = (data) => {
      console.log('[Socket] standings:update received:', data);
      if (handlersRef.current.onStandingsUpdate) {
        handlersRef.current.onStandingsUpdate(data);
      }
    };

    const handleStageAdvanced = (data) => {
      console.log('[Socket] stage:advanced received:', data);
      if (handlersRef.current.onStageAdvanced) {
        handlersRef.current.onStageAdvanced(data);
      }
    };

    socket.on('match:update', handleMatchUpdate);
    socket.on('standings:update', handleStandingsUpdate);
    socket.on('stage:advanced', handleStageAdvanced);

    return () => {
      socket.off('match:update', handleMatchUpdate);
      socket.off('standings:update', handleStandingsUpdate);
      socket.off('stage:advanced', handleStageAdvanced);
    };
  }, [tournamentId]);
}
