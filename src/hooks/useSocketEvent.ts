'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/context/SocketProvider';

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;

    const stableHandler = (data: T) => handlerRef.current(data);
    socket.on(event, stableHandler);

    return () => {
      socket.off(event, stableHandler);
    };
  }, [socket, event]);
}

export function useSocketEmit() {
  const { socket } = useSocket();

  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socket?.connected) {
        socket.emit(event, data);
      } else {
        console.warn('[Socket] Cannot emit — not connected');
      }
    },
    [socket]
  );

  return emit;
}
