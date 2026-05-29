import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react';
import { useSocket } from './SocketContext';
import { ParticipantInfo, VideoState, ChatMessage, Role } from '../types';

interface RoomState {
  roomCode:     string;
  myUserId:     string;
  myRole:       Role;
  participants: ParticipantInfo[];
  videoState:   VideoState | null;
  messages:     ChatMessage[];
  isInRoom:     boolean;
}

interface RoomContextValue extends RoomState {
  joinRoom:  (roomCode: string, username: string) => void;
  leaveRoom: () => void;
}

const defaultState: RoomState = {
  roomCode:     '',
  myUserId:     '',
  myRole:       'participant',
  participants: [],
  videoState:   null,
  messages:     [],
  isInRoom:     false,
};

const RoomContext = createContext<RoomContextValue>({
  ...defaultState,
  joinRoom:  () => {},
  leaveRoom: () => {},
});

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [state, setState] = useState<RoomState>(defaultState);

  const joinRoom = useCallback((roomCode: string, username: string) => {
    if (!socket) return;
    socket.emit('join_room', { roomCode, username });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (!socket || !state.roomCode) return;
    socket.emit('leave_room', { roomCode: state.roomCode });
    setState(defaultState);
    // Clear persisted room code
    localStorage.removeItem('wp_room_code');
    localStorage.removeItem('wp_username');
  }, [socket, state.roomCode]);

  useEffect(() => {
    if (!socket) return;

    // ── Incoming events from server ──────────────────────────────────────────

    // Fired when we successfully join
    socket.on('joined', ({ userId, role, roomCode, videoState, participants }: {
      userId: string; role: Role; roomCode: string;
      videoState: VideoState; participants: ParticipantInfo[];
    }) => {
      setState(prev => ({
        ...prev,
        myUserId: userId, myRole: role, roomCode, videoState, participants,
        isInRoom: true,
      }));
      // Persist so reconnect works after refresh
      localStorage.setItem('wp_room_code', roomCode);
    });

    socket.on('sync_state', (videoState: VideoState) => {
      setState(prev => ({ ...prev, videoState }));
    });

    socket.on('user_joined', ({ participants }: { participants: ParticipantInfo[] }) => {
      setState(prev => ({
        ...prev,
        participants,
        myRole: participants.find(p => p.userId === prev.myUserId)?.role ?? prev.myRole
      }));
    });

    socket.on('user_left', ({ participants }: { participants: ParticipantInfo[] }) => {
      setState(prev => ({
        ...prev,
        participants,
        myRole: participants.find(p => p.userId === prev.myUserId)?.role ?? prev.myRole
      }));
    });

    socket.on('participants_updated', ({ participants }: { participants: ParticipantInfo[] }) => {
      setState(prev => ({
        ...prev,
        participants,
        myRole: participants.find(p => p.userId === prev.myUserId)?.role ?? prev.myRole
      }));
    });

    socket.on('role_assigned', ({ participants }: {
      userId: string; role: Role; participants: ParticipantInfo[];
    }) => {
      setState(prev => ({
        ...prev,
        participants,
        myRole: participants.find(p => p.userId === prev.myUserId)?.role ?? prev.myRole
      }));
    });

    socket.on('host_transferred', ({ newHostId, participants }: {
      newHostId: string; participants: ParticipantInfo[];
    }) => {
      setState(prev => {
        // Look up our new role from the updated participant list
        const me = participants.find(p => p.userId === prev.myUserId);
        return {
          ...prev,
          participants,
          myRole: me?.role ?? (newHostId === prev.myUserId ? 'host' : 'participant'),
        };
      });
    });

    socket.on('participant_removed', ({ participants }: { participants: ParticipantInfo[] }) => {
      setState(prev => ({ ...prev, participants }));
    });

    // We were removed — boot back to home
    socket.on('removed_from_room', () => {
      setState(defaultState);
      localStorage.removeItem('wp_room_code');
      localStorage.removeItem('wp_username');
      // Navigate handled by Room.tsx detecting isInRoom === false
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, msg].slice(-200), // keep last 200
      }));
    });

    socket.on('error', ({ message }: { message: string }) => {
      alert(`Error: ${message}`);
    });

    return () => {
      socket.off('joined');
      socket.off('sync_state');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('participants_updated');
      socket.off('role_assigned');
      socket.off('host_transferred');
      socket.off('participant_removed');
      socket.off('removed_from_room');
      socket.off('chat_message');
      socket.off('error');
    };
  }, [socket]);

  return (
    <RoomContext.Provider value={{ ...state, joinRoom, leaveRoom }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  return useContext(RoomContext);
}
