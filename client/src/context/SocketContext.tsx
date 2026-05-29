import React, {
  createContext, useContext, useEffect, useState,
} from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket:      null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  // useState (not useRef) so that when the socket is created,
  // all consumers re-render and get the actual socket instance.
  // useRef silently holds the value but never triggers re-renders —
  // that was why socket was always null in children.
  const [socket, setSocket]           = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = io(API_URL, {
      transports:      ['websocket', 'polling'],
      withCredentials: true,
      reconnection:    true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,
    });

    s.on('connect',    () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    setSocket(s);

    return () => { s.disconnect(); };
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