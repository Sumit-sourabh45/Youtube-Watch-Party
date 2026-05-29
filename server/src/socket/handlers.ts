import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from '../classes/RoomManager';
import { Participant, Role } from '../classes/Participant';
import { db } from '../db';
import { rooms as roomsTable, participants as participantsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

// ── Helper: broadcast updated participant list to whole room ──────────────────
function broadcastParticipants(io: Server, roomCode: string) {
  const room = roomManager.getByCode(roomCode);
  if (!room) return;
  io.to(roomCode).emit('participants_updated', {
    participants: room.participantList(),
  });
}

// ── Helper: shared cleanup when a user leaves (used by leave_room + disconnect)
async function removeFromRoom(
  io: Server,
  socket: Socket,
  roomCode: string,
): Promise<boolean> {
  const room = roomManager.getByCode(roomCode);
  if (!room) return false;

  const left = room.removeParticipant(socket.id);
  if (!left) return false;

  // Leave the Socket.IO room
  socket.leave(roomCode);

  // Update DB — non-fatal on failure
  await db
    .delete(participantsTable)
    .where(eq(participantsTable.socketId, socket.id))
    .catch(() => {});

  if (room.isEmpty()) {
    // Last person left — remove room from memory (DB record stays for history)
    roomManager.delete(roomCode);
    console.log(`[room:${roomCode}] empty, removed from memory`);
  } else {
    // If the host left, promote the earliest participant to host
    if (!room.hasHost()) {
      const oldest = room.getAll()[0];
      oldest.role = 'host';
      io.to(roomCode).emit('role_assigned', {
        userId:       oldest.userId,
        username:     oldest.username,
        role:         'host',
        participants: room.participantList(),
      });
    }

    io.to(roomCode).emit('user_left', {
      userId:       left.userId,
      username:     left.username,
      participants: room.participantList(),
    });
  }

  return true;
}

// ── Register all Socket.IO event handlers ────────────────────────────────────
export function registerSocketHandlers(io: Server): void {

  io.on('connection', (socket: Socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── join_room ─────────────────────────────────────────────────────────────
    // Client sends { roomCode, username }
    // Server assigns role (host if first joiner, else participant), responds with state.
    socket.on('join_room', async ({ roomCode, username }: { roomCode: string; username: string }) => {
      console.log(`[join_room] Received join request: ${roomCode} from ${username}`);
      
      // ── Guard: Prevent concurrent join_room calls from the same socket (e.g. React StrictMode)
      if ((socket as any)._isJoining) {
        console.log(`[join_room] Duplicate join blocked for ${socket.id}`);
        return;
      }
      (socket as any)._isJoining = true;

      try {
        const code = roomCode.toUpperCase().trim();
        let room = roomManager.getByCode(code);
        console.log(`[join_room] room in memory:`, !!room);

        // Room must exist in DB
        if (!room) {
          console.log(`[join_room] Querying DB for room ${code}...`);
          const [dbRoom] = await db
            .select()
            .from(roomsTable)
            .where(eq(roomsTable.code, code))
            .limit(1);
          console.log(`[join_room] DB query result:`, !!dbRoom);

          if (!dbRoom) {
            socket.emit('error', { message: 'Room not found.' });
            return;
          }

          // Re-hydrate into memory (e.g. after server restart)
          room = roomManager.create(dbRoom.id, code);
        }

        // ── Guard: if this socket already joined this room, re-send state ─────
        const existing = room.getBySocketId(socket.id);
        if (existing) {
          socket.emit('joined', {
            userId:       existing.userId,
            role:         existing.role,
            roomCode:     code,
            videoState:   room.videoState,
            participants: room.participantList(),
          });
          return;
        }

        // Determine role: first in = host, everyone else = participant
        const role: Role = room.isEmpty() ? 'host' : 'participant';
        const userId = uuidv4();

        const participant = new Participant(userId, socket.id, username.trim(), role);
        room.addParticipant(participant);

        // Join the Socket.IO room (rooms are identified by their invite code)
        socket.join(code);

        // Store roomCode on the socket data for disconnect cleanup
        (socket as any)._wpRoomCode = code;

        console.log(`[join_room] Inserting participant into DB...`);
        // Persist to DB
        await db.insert(participantsTable).values({
          roomId:   room.roomId,
          username: participant.username,
          role:     participant.role,
          socketId: socket.id,
        });
        console.log(`[join_room] Participant inserted.`);

        // Tell the joiner their own info + current video state
        socket.emit('joined', {
          userId,
          role: participant.role,
          roomCode: code,
          videoState: room.videoState,
          participants: room.participantList(),
        });
        console.log(`[join_room] Successfully joined!`);

        // Tell everyone else a new person joined
        socket.to(code).emit('user_joined', {
          userId,
          username: participant.username,
          role: participant.role,
          participants: room.participantList(),
        });

        console.log(`[room:${code}] ${username} joined as ${role}`);
      } catch (err) {
        console.error('[join_room] error:', err);
        socket.emit('error', { message: 'Failed to join room.' });
      } finally {
        (socket as any)._isJoining = false;
      }
    });

    // ── leave_room ────────────────────────────────────────────────────────────
    // Client explicitly leaves the room (via "Leave" button).
    socket.on('leave_room', async ({ roomCode }: { roomCode: string }) => {
      try {
        const code = roomCode.toUpperCase().trim();
        await removeFromRoom(io, socket, code);
        console.log(`[room:${code}] socket ${socket.id} left`);
      } catch (err) {
        console.error('[leave_room] error:', err);
      }
    });

    // ── play ──────────────────────────────────────────────────────────────────
    // Requires host or moderator. Broadcasts play + updated currentTime.
    socket.on('play', ({ roomCode, currentTime }: { roomCode: string; currentTime: number }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canControl()) return;

      room.setState({ playing: true, currentTime });

      io.to(roomCode).emit('sync_state', {
        ...room.videoState,
        triggeredBy: actor.userId,
      });
    });

    // ── pause ─────────────────────────────────────────────────────────────────
    socket.on('pause', ({ roomCode, currentTime }: { roomCode: string; currentTime: number }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canControl()) return;

      room.setState({ playing: false, currentTime });

      io.to(roomCode).emit('sync_state', {
        ...room.videoState,
        triggeredBy: actor.userId,
      });
    });

    // ── seek ──────────────────────────────────────────────────────────────────
    socket.on('seek', ({ roomCode, currentTime }: { roomCode: string; currentTime: number }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canControl()) return;

      room.setState({ currentTime });

      io.to(roomCode).emit('sync_state', {
        ...room.videoState,
        triggeredBy: actor.userId,
      });
    });

    // ── change_video ──────────────────────────────────────────────────────────
    socket.on('change_video', ({ roomCode, videoId }: { roomCode: string; videoId: string }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canControl()) return;

      room.setState({ videoId, playing: false, currentTime: 0 });

      io.to(roomCode).emit('sync_state', {
        ...room.videoState,
        triggeredBy: actor.userId,
      });
    });

    // ── assign_role ───────────────────────────────────────────────────────────
    // Host only. Changes the role of another participant.
    socket.on('assign_role', ({ roomCode, targetUserId, newRole }: {
      roomCode:     string;
      targetUserId: string;
      newRole:      Role;
    }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canManageRoom()) return;

      // Prevent host from accidentally downgrading themselves
      if (actor.userId === targetUserId && newRole !== 'host') return;

      const updated = room.assignRole(targetUserId, newRole);
      if (!updated) return;

      io.to(roomCode).emit('role_assigned', {
        userId:       targetUserId,
        username:     updated.username,
        role:         newRole,
        participants: room.participantList(),
      });
    });

    // ── transfer_host ─────────────────────────────────────────────────────────
    // Host passes host role to another participant.
    socket.on('transfer_host', ({ roomCode, toUserId }: { roomCode: string; toUserId: string }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canManageRoom()) return;

      const success = room.transferHost(socket.id, toUserId);
      if (!success) return;

      io.to(roomCode).emit('host_transferred', {
        newHostId:    toUserId,
        participants: room.participantList(),
      });
    });

    // ── remove_participant ────────────────────────────────────────────────────
    // Host only. Kicks a participant from the room.
    socket.on('remove_participant', ({ roomCode, targetUserId }: {
      roomCode:     string;
      targetUserId: string;
    }) => {
      const room = roomManager.getByCode(roomCode);
      const actor = room?.getBySocketId(socket.id);
      if (!room || !actor?.canManageRoom()) return;

      const target = room.getByUserId(targetUserId);
      if (!target || target.role === 'host') return; // can't remove yourself / another host

      room.removeParticipant(target.socketId);

      // Tell the kicked socket to leave, then disconnect them from the room
      io.to(target.socketId).emit('removed_from_room', { roomCode });
      io.sockets.sockets.get(target.socketId)?.leave(roomCode);

      io.to(roomCode).emit('participant_removed', {
        userId:       targetUserId,
        participants: room.participantList(),
      });
    });

    // ── request_sync ─────────────────────────────────────────────────────────
    // A late-joiner (or reconnect) asks for the current video state.
    socket.on('request_sync', ({ roomCode }: { roomCode: string }) => {
      const room = roomManager.getByCode(roomCode);
      if (!room) return;

      // Adjust currentTime for how long ago the state was stamped
      const elapsed = room.videoState.playing
        ? (Date.now() - room.videoState.updatedAt) / 1000
        : 0;

      socket.emit('sync_state', {
        ...room.videoState,
        currentTime: room.videoState.currentTime + elapsed,
      });
    });

    // ── chat_message (bonus) ──────────────────────────────────────────────────
    socket.on('chat_message', ({ roomCode, message }: { roomCode: string; message: string }) => {
      const room = roomManager.getByCode(roomCode);
      const sender = room?.getBySocketId(socket.id);
      if (!room || !sender || !message?.trim()) return;

      io.to(roomCode).emit('chat_message', {
        userId:   sender.userId,
        username: sender.username,
        message:  message.trim().slice(0, 500), // cap at 500 chars
        sentAt:   Date.now(),
      });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    // Clean up participant from any room they were in.
    socket.on('disconnect', async () => {
      console.log(`[socket] disconnected: ${socket.id}`);

      // Try fast path: we stored roomCode on socket during join
      const savedCode = (socket as any)._wpRoomCode as string | undefined;
      if (savedCode) {
        await removeFromRoom(io, socket, savedCode);
        return;
      }

      // Fallback: search all rooms (handles edge cases)
      for (const [code] of roomManager.getAllRooms()) {
        const removed = await removeFromRoom(io, socket, code);
        if (removed) break; // a socket can only be in one room
      }
    });
  });
}
