import { Router, Request, Response } from 'express';
import { db } from '../db';
import { rooms as roomsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { roomManager } from '../classes/RoomManager';

const router = Router();

// ── Generate a unique 6-character invite code ─────────────────────────────────
function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── POST /api/rooms  ──────────────────────────────────────────────────────────
// Creates a new room. Returns { roomId, code }.
router.post('/', async (req: Request, res: Response) => {
  try {
    // Generate a code that doesn't already exist in DB
    let code = generateCode();
    let existing = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.code, code))
      .limit(1);

    // Retry on collision (extremely rare, but correct)
    while (existing.length > 0) {
      code = generateCode();
      existing = await db
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.code, code))
        .limit(1);
    }

    // Insert into DB
    const [newRoom] = await db
      .insert(roomsTable)
      .values({ code })
      .returning();

    // Pre-create Room in memory so the host can join immediately via socket
    roomManager.create(newRoom.id, newRoom.code);

    res.status(201).json({ roomId: newRoom.id, code: newRoom.code });
  } catch (err) {
    console.error('[POST /api/rooms] error:', err);
    res.status(500).json({ message: 'Failed to create room.' });
  }
});

// ── GET /api/rooms/:code  ─────────────────────────────────────────────────────
// Check if a room exists before the user tries to join.
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code.toUpperCase().trim();

    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.code, code))
      .limit(1);

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    // Include live participant count from memory if available
    const activeRoom = roomManager.getByCode(code);

    res.json({
      roomId:           room.id,
      code:             room.code,
      createdAt:        room.createdAt,
      participantCount: activeRoom ? activeRoom.getAll().length : 0,
    });
  } catch (err) {
    console.error('[GET /api/rooms/:code] error:', err);
    res.status(500).json({ message: 'Failed to fetch room.' });
  }
});

export default router;
