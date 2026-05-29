// ── Shared types used across the entire client ────────────────────────────────

export type Role = 'host' | 'moderator' | 'participant';

export interface ParticipantInfo {
  userId:   string;
  username: string;
  role:     Role;
  socketId: string;
}

export interface VideoState {
  videoId:     string;
  playing:     boolean;
  currentTime: number;
  updatedAt:   number;
}

export interface ChatMessage {
  userId:   string;
  username: string;
  message:  string;
  sentAt:   number;
}
