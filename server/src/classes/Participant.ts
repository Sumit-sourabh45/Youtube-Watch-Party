// ── Types ─────────────────────────────────────────────────────────────────────
export type Role = 'host' | 'moderator' | 'participant';

export interface ParticipantJSON {
  userId:   string;
  username: string;
  role:     Role;
  socketId: string;
}

// ── Participant class ─────────────────────────────────────────────────────────
// Represents a single connected user.
// Lives in memory inside a Room instance.
export class Participant {
  constructor(
    public readonly userId:   string,   // stable UUID (from session)
    public readonly socketId: string,   // current Socket.IO socket id
    public username:          string,
    public role:              Role,
  ) {}

  // ── Permission helpers ──────────────────────────────────────────────────────

  /** Can control playback (play, pause, seek, change video) */
  canControl(): boolean {
    return this.role === 'host' || this.role === 'moderator';
  }

  /** Can assign or remove roles, remove participants */
  canManageRoom(): boolean {
    return this.role === 'host';
  }

  // ── Serialisation ───────────────────────────────────────────────────────────

  toJSON(): ParticipantJSON {
    return {
      userId:   this.userId,
      username: this.username,
      role:     this.role,
      socketId: this.socketId,
    };
  }
}
