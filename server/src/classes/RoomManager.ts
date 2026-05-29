import { Room } from './Room';

// ── RoomManager ───────────────────────────────────────────────────────────────
// Singleton that owns all active Room instances.
// Rooms are created here when a host creates a room via REST,
// and cleaned up when the last participant leaves.
class RoomManager {
  // code → Room  (invite code is the natural look-up key)
  private rooms: Map<string, Room> = new Map();

  // ── CRUD ────────────────────────────────────────────────────────────────────

  create(roomId: string, code: string): Room {
    if (this.rooms.has(code)) {
      return this.rooms.get(code)!;
    }
    const room = new Room(roomId, code);
    this.rooms.set(code, room);
    return room;
  }

  getByCode(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getByRoomId(roomId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.roomId === roomId) return room;
    }
    return undefined;
  }

  /** Remove a room from memory (called when last participant leaves) */
  delete(code: string): void {
    this.rooms.delete(code);
  }

  activeCount(): number {
    return this.rooms.size;
  }

  /** Iterate all active rooms (used by disconnect handler) */
  getAllRooms(): Map<string, Room> {
    return this.rooms;
  }
}

// Export a single shared instance
export const roomManager = new RoomManager();
