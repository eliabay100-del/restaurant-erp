'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();

    function onConnect() {
      setIsConnected(true);
      console.log('[Socket] Connected:', s.id);
    }

    function onDisconnect() {
      setIsConnected(false);
      console.log('[Socket] Disconnected');
    }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // Deferred by a microtask so the socket is published to context after the
    // first render commits (avoids a synchronous setState inside the effect).
    queueMicrotask(() => {
      setSocket(s);
      setIsConnected(s.connected);
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
