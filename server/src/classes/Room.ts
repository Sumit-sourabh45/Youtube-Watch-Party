import { Participant, Role, ParticipantJSON } from './Participant';

// ── Video state ───────────────────────────────────────────────────────────────
export interface VideoState {
  videoId:     string;
  playing:     boolean;
  currentTime: number;
  updatedAt:   number; // epoch ms — lets late joiners sync accurately
}

// ── Room class ────────────────────────────────────────────────────────────────
// One instance per active watch room.
// Owns the participant list and the current video state.
// The RoomManager singleton holds a Map of all active Room instances.
export class Room {
  public readonly roomId: string;  // DB uuid
  public readonly code:   string;  // 6-char invite code

  // socketId → Participant  (fast look-up on every socket event)
  private participants: Map<string, Participant> = new Map();

  public videoState: VideoState = {
    videoId:     '',
    playing:     false,
    currentTime: 0,
    updatedAt:   Date.now(),
  };

  constructor(roomId: string, code: string) {
    this.roomId = roomId;
    this.code   = code;
  }

  // ── Participant management ──────────────────────────────────────────────────

  addParticipant(participant: Participant): void {
    this.participants.set(participant.socketId, participant);
  }

  /** Returns the removed participant (or undefined if not found) */
  removeParticipant(socketId: string): Participant | undefined {
    const p = this.participants.get(socketId);
    this.participants.delete(socketId);
    return p;
  }

  getBySocketId(socketId: string): Participant | undefined {
    return this.participants.get(socketId);
  }

  getByUserId(userId: string): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.userId === userId) return p;
    }
    return undefined;
  }

  getAll(): Participant[] {
    return Array.from(this.participants.values());
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }

  hasHost(): boolean {
    return this.getAll().some(p => p.role === 'host');
  }

  // ── Video state ─────────────────────────────────────────────────────────────

  /** Merge partial state update — always stamps updatedAt */
  setState(patch: Partial<Omit<VideoState, 'updatedAt'>>): void {
    this.videoState = { ...this.videoState, ...patch, updatedAt: Date.now() };
  }

  // ── Role management ─────────────────────────────────────────────────────────

  /**
   * Assign a new role to a participant (by userId).
   * Returns the updated participant, or null if not found.
   */
  assignRole(targetUserId: string, newRole: Role): Participant | null {
    const target = this.getByUserId(targetUserId);
    if (!target) return null;
    target.role = newRole;
    return target;
  }

  /**
   * Transfer the host role:
   * current host → participant, target user → host.
   * Returns true on success.
   */
  transferHost(fromSocketId: string, toUserId: string): boolean {
    const from = this.getBySocketId(fromSocketId);
    const to   = this.getByUserId(toUserId);
    if (!from || !to || from.role !== 'host') return false;
    from.role = 'participant';
    to.role   = 'host';
    return true;
  }

  // ── Serialisation ───────────────────────────────────────────────────────────

  /** Safe list of participants to send over the wire */
  participantList(): ParticipantJSON[] {
    return this.getAll().map(p => p.toJSON());
  }
}
